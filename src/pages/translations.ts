export type Language = "en" | "fr";

export interface Translations {
  readonly lang: Language;
  readonly htmlLang: string;
  readonly siteTitle: string;
  readonly metaDescription: string;
  readonly introText: string;
  readonly dataSourceText: string;
  readonly dataSourceLink: string;
  readonly searchPlaceholder: string;
  readonly clearSearch: string;
  readonly showOpenOnly: string;
  readonly showMultipleRinks: string;
  readonly rinkType: string;
  readonly recentMaintenance: string;
  readonly allTime: string;
  readonly last4Hours: string;
  readonly last12Hours: string;
  readonly last24Hours: string;
  readonly last7Days: string;
  readonly type: string;
  readonly status: string;
  readonly lastUpdated: string;
  readonly address: string;
  readonly open: string;
  readonly closed: string;
  readonly yes: string;
  readonly no: string;
  readonly rink: string;
  readonly language: string;
  readonly closeIntro: string;
}

const translations: Record<Language, Translations> = {
  fr: {
    lang: "fr",
    htmlLang: "fr",
    siteTitle: "Patinoires extérieures à Montréal – Carte interactive et entretien récent",
    metaDescription:
      "Carte interactive des patinoires extérieures de Montréal avec conditions de glace en temps réel, mises à jour d'entretien récentes et emplacements dans toute la ville. Données provenant du site Web officiel de la Ville de Montréal.",
    introText:
      "Carte interactive des patinoires extérieures de Montréal montrant les conditions de glace en temps réel, les mises à jour d'entretien récentes et les emplacements dans toute la ville. Trouvez votre patinoire extérieure la plus proche et vérifiez si elle est ouverte avant de partir.",
    dataSourceText: "Données provenant du",
    dataSourceLink: "site Web officiel de la Ville de Montréal",
    searchPlaceholder: "Rechercher des patinoires...",
    clearSearch: "Effacer la recherche",
    showOpenOnly: "Afficher uniquement les patinoires ouvertes",
    showMultipleRinks: "Afficher uniquement les emplacements avec plusieurs patinoires",
    rinkType: "Type de patinoire :",
    recentMaintenance: "Entretien récent :",
    allTime: "Tout le temps",
    last4Hours: "Dernières 4 heures",
    last12Hours: "Dernières 12 heures",
    last24Hours: "Dernières 24 heures",
    last7Days: "Derniers 7 jours",
    type: "Type :",
    status: "Statut :",
    lastUpdated: "Dernière mise à jour :",
    address: "Adresse :",
    open: "Ouvert",
    closed: "Fermé",
    yes: "Oui",
    no: "Non",
    rink: "Patinoire",
    language: "Langue",
    closeIntro: "Fermer",
  },
  en: {
    lang: "en",
    htmlLang: "en",
    siteTitle: "Outdoor Hockey Rinks in Montreal – Live Map & Recent Maintenance",
    metaDescription:
      "Interactive map of Montreal's outdoor hockey rinks (patinoires extérieures) with real-time ice conditions, recent maintenance updates, and locations across the city. Data sourced from the official City of Montreal website.",
    introText:
      "Interactive map of Montreal's outdoor hockey rinks (patinoires extérieures à Montréal) showing real-time ice conditions, recent maintenance updates, and locations across the city. Find your nearest outdoor rink (ODR) and check if it's open before you head out.",
    dataSourceText: "Data sourced from the",
    dataSourceLink: "official City of Montreal website",
    searchPlaceholder: "Search rinks...",
    clearSearch: "Clear search",
    showOpenOnly: "Show only open rinks",
    showMultipleRinks: "Show only locations with multiple rinks",
    rinkType: "Rink type:",
    recentMaintenance: "Recent maintenance:",
    allTime: "All time",
    last4Hours: "Last 4 hours",
    last12Hours: "Last 12 hours",
    last24Hours: "Last 24 hours",
    last7Days: "Last 7 days",
    type: "Type:",
    status: "Status:",
    lastUpdated: "Last Updated:",
    address: "Address:",
    open: "Open",
    closed: "Closed",
    yes: "Yes",
    no: "No",
    rink: "Rink",
    language: "Language",
    closeIntro: "Close",
  },
};

export function getTranslations(lang: Language): Translations {
  return translations[lang];
}

export function isValidLanguage(lang: string): lang is Language {
  return lang === "en" || lang === "fr";
}
