// Les textes de l'arrivée dans l'appli (accueil, rejoindre, créer une maison), au même endroit
// pour les relire et les ajuster facilement. Les longueurs sont pensées pour un iPhone.

export const ONBOARDING = {
  home: {
    headline: 'Un petit chez-nous, même à distance.',
    description: 'Photos, petits mots, rendez-vous et listes partagées… Votre quotidien se retrouve ici.',
    create_cta: 'Créer notre maison',
    join_cta: 'Rejoindre mes proches',
  },
  join: {
    title: 'Rejoindre une maison',
    description: 'Entre le code reçu de ton proche.',
    field_label: 'Code d’invitation',
    placeholder: 'Ton code à 6 caractères',
    submit: 'Vérifier le code',
    helper: 'Pas de code ? Demande-en un à ton proche.',
    back: 'Retour',
    empty_code: 'Entre ton code pour continuer.',
    invalid_code: 'Ce code ne semble pas valide. Vérifie-le et réessaie.',
    network_error: 'Impossible de vérifier le code pour le moment. Réessaie.',
    loading: 'Vérification…',
  },
  create: {
    title: 'Votre petit chez-vous',
    description: 'Donnez un nom à votre maison et choisissez l’ambiance qui vous ressemble.',
    field_label: 'Comment s’appelle votre maison ?',
    placeholder: 'Ex. Notre petit cocon',
    default_name: 'Notre maison',
    decor: 'Votre ambiance',
    decor_later: 'Vous pourrez changer de décor plus tard.',
    submit: 'Créer notre chez-nous',
    empty_name: 'Ajoute un nom pour continuer.',
    name_too_long: 'Le nom ne peut pas dépasser 40 caractères.',
    create_error: 'La maison n’a pas pu être créée. Réessaie.',
    loading: 'Création…',
  },
  invite: {
    title: 'Votre petit chez-vous est prêt ✨',
    description: 'Il ne manque plus que tes proches pour lui donner vie.',
    code_hint: 'Partage ce code avec tes proches. Chaque demande devra être acceptée par toi.',
    code_validite: 'Code valable 7 jours.',
    share: 'Inviter mes proches',
    enter: 'Découvrir ma maison',
    later: 'Tu pourras aussi les inviter plus tard depuis l’onglet Famille.',
  },
} as const
