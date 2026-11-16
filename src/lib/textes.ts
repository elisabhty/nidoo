// Les textes de l'arrivée dans l'appli (accueil, rejoindre, créer une maison), au même endroit
// pour les relire et les ajuster facilement. Les longueurs sont pensées pour un iPhone.

export const ONBOARDING = {
  home: {
    headline: 'Un petit chez-vous, même à distance.',
    description: 'Partagez une photo ou un dessin avec vos proches et gardez le lien.',
    create_cta: 'Créer notre maison',
    join_cta: 'J’ai un code d’invitation',
  },
  join: {
    title: 'Rejoindre une maison',
    description: 'Entrez le code d’invitation reçu.',
    field_label: 'Code d’invitation',
    placeholder: 'Votre code',
    submit: 'Rejoindre',
    helper: 'Pas de code ? Demandez-en un à votre proche.',
    back: 'Retour',
    empty_code: 'Entrez votre code pour continuer.',
    invalid_code: 'Ce code ne semble pas valide. Vérifiez-le et réessayez.',
    network_error: 'Impossible de vérifier le code pour le moment. Réessayez.',
    loading: 'Vérification…',
  },
  create: {
    title: 'Créer une maison',
    description: 'Choisissez un nom pour votre espace partagé.',
    field_label: 'Nom de la maison',
    placeholder: 'Notre maison',
    submit: 'Créer',
    empty_name: 'Saisissez un nom pour continuer.',
    name_too_long: 'Le nom ne peut pas dépasser 40 caractères.',
    create_error: 'La maison n’a pas pu être créée. Réessayez.',
    loading: 'Création…',
  },
} as const
