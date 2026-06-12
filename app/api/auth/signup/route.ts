import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/auth/signup
 * Crée un compte utilisateur + profil via la clé service role.
 * Contourne le trigger handle_new_user() et les politiques RLS.
 */
export async function POST(req: Request) {
  try {
    const { email, password, nom_complet, type_profil, pays_residence, telephone } = await req.json()

    if (!email || !password || !nom_complet) {
      return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
    }

    // Client admin (service role) — uniquement côté serveur
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Créer l'utilisateur auth
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Pas de confirmation email requise
      user_metadata: { nom_complet, type_profil },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = userData.user.id

    // 2. Créer le profil (bypass trigger + RLS)
    const { error: profilError } = await supabaseAdmin
      .from('profils')
      .upsert({
        id: userId,
        nom_complet,
        email,
        telephone: telephone || null,
        pays_residence: pays_residence || 'Côte d\'Ivoire',
        type_profil: type_profil || 'local',
        statut_kyc: 'non_soumis',
        is_admin: false,
        is_super_admin: false,
      })

    if (profilError) {
      // Rollback : supprimer l'utilisateur auth si le profil échoue
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profilError.message }, { status: 500 })
    }

    // 3. Connecter l'utilisateur (obtenir une session)
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !signInData.session) {
      return NextResponse.json({ error: 'Compte créé mais connexion échouée — connectez-vous manuellement' }, { status: 200 })
    }

    return NextResponse.json({
      success: true,
      session: signInData.session,
      user: userData.user,
    })
  } catch (err) {
    console.error('[signup] Erreur inattendue:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
