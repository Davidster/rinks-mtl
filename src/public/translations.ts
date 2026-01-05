export type Language = "en" | "fr";

export interface ClientTranslations {
  readonly type: string;
  readonly status: string;
  readonly lastUpdated: string;
  readonly address: string;
  readonly open: string;
  readonly yes: string;
  readonly no: string;
  readonly rink: string;
  readonly noRinkInfo: string;
  readonly unknown: string;
}

const translations: Record<Language, ClientTranslations> = {
  fr: {
    type: "Type :",
    status: "Statut :",
    lastUpdated: "Dernière mise à jour :",
    address: "Adresse :",
    open: "Ouvert :",
    yes: "Oui",
    no: "Non",
    rink: "Patinoire",
    noRinkInfo: "Aucune information sur la patinoire disponible.",
    unknown: "Inconnu",
  },
  en: {
    type: "Type:",
    status: "Status:",
    lastUpdated: "Last Updated:",
    address: "Address:",
    open: "Open:",
    yes: "Yes",
    no: "No",
    rink: "Rink",
    noRinkInfo: "No rink information available.",
    unknown: "Unknown",
  },
};

export function getClientTranslations(lang: Language): ClientTranslations {
  return translations[lang];
}

export function getCurrentLanguage(): Language {
  // @ts-expect-error - window.__LANG__ is set by server
  const lang = window.__LANG__;
  return lang === "en" || lang === "fr" ? lang : "fr";
}

