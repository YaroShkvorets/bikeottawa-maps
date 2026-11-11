import { createContext, useContext } from 'react'

export type Lang = 'en' | 'fr'

const en = {
  title: 'Bike Ottawa Maps',
  switchLang: 'Français',
  switchLangShort: 'FR',
  layers: 'Layer',
  legend: 'Legend',
  'layer.comfort': 'Comfort',
  'layer.comfort.desc': 'How stressful each street is to ride',
  'layer.winter': 'Winter',
  'layer.winter.desc': 'Which pathways get plowed',
  'layer.places': 'Places',
  'layer.places.desc': 'Parking, repair, water and washrooms',
  'lts.1': 'Comfortable for everyone',
  'lts.2': 'Fine for most adults',
  'lts.3': 'Confident riders only',
  'lts.4': 'High stress, avoid if you can',
  'lts.0': 'Closed to bikes',
  'winter.yes': 'Plowed',
  'winter.no': 'Not plowed',
  'winter.unknown': 'Unknown',
  'place.parking': 'Bike parking',
  'place.repair': 'Repair station',
  'place.shop': 'Bike shop',
  'place.water': 'Drinking water',
  'place.toilets': 'Washroom',
  'kind.path': 'Pathway',
  'kind.street': 'Street',
  'fact.comfort': 'Comfort',
  'fact.winter': 'Winter',
  'fact.surface': 'Surface',
  'fact.smoothness': 'Smoothness',
  'fact.width': 'Width',
  'fact.lit': 'Lit',
  'fact.maxspeed': 'Speed limit',
  'fact.lanes': 'Lanes',
  'fact.capacity': 'Capacity',
  'fact.covered': 'Covered',
  'fact.bicycle_parking': 'Type',
  'fact.opening_hours': 'Hours',
  'fact.fee': 'Fee',
  'fact.seasonal': 'Seasonal',
  'fact.website': 'Website',
  yes: 'Yes',
  no: 'No',
  close: 'Close',
  viewOnOsm: 'View on OpenStreetMap',
  fixOnOsm: 'Something wrong? Fix it on OpenStreetMap',
  hint: 'Select anything on the map to see its details.',
  dataFrom: 'Map data from OpenStreetMap',
  updated: 'updated',
}

const fr: Record<keyof typeof en, string> = {
  title: 'Cartes Bike Ottawa',
  switchLang: 'English',
  switchLangShort: 'EN',
  layers: 'Couche',
  legend: 'Légende',
  'layer.comfort': 'Confort',
  'layer.comfort.desc': 'Le niveau de stress de chaque rue à vélo',
  'layer.winter': 'Hiver',
  'layer.winter.desc': 'Les sentiers déneigés',
  'layer.places': 'Lieux',
  'layer.places.desc': 'Stationnement, réparation, eau et toilettes',
  'lts.1': 'Confortable pour tous',
  'lts.2': 'Convient à la plupart des adultes',
  'lts.3': 'Cyclistes expérimentés seulement',
  'lts.4': 'Stress élevé, à éviter si possible',
  'lts.0': 'Interdit aux vélos',
  'winter.yes': 'Déneigé',
  'winter.no': 'Non déneigé',
  'winter.unknown': 'Inconnu',
  'place.parking': 'Stationnement pour vélos',
  'place.repair': 'Station de réparation',
  'place.shop': 'Boutique de vélos',
  'place.water': 'Eau potable',
  'place.toilets': 'Toilettes',
  'kind.path': 'Sentier',
  'kind.street': 'Rue',
  'fact.comfort': 'Confort',
  'fact.winter': 'Hiver',
  'fact.surface': 'Surface',
  'fact.smoothness': 'État de la surface',
  'fact.width': 'Largeur',
  'fact.lit': 'Éclairé',
  'fact.maxspeed': 'Limite de vitesse',
  'fact.lanes': 'Voies',
  'fact.capacity': 'Capacité',
  'fact.covered': 'Couvert',
  'fact.bicycle_parking': 'Type',
  'fact.opening_hours': 'Heures',
  'fact.fee': 'Payant',
  'fact.seasonal': 'Saisonnier',
  'fact.website': 'Site web',
  yes: 'Oui',
  no: 'Non',
  close: 'Fermer',
  viewOnOsm: 'Voir sur OpenStreetMap',
  fixOnOsm: 'Une erreur? Corrigez-la sur OpenStreetMap',
  hint: 'Sélectionnez un élément sur la carte pour voir ses détails.',
  dataFrom: 'Données cartographiques d’OpenStreetMap',
  updated: 'mises à jour le',
}

export type MessageKey = keyof typeof en
export type Translate = (key: MessageKey) => string

const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, fr }

export function translator(lang: Lang): Translate {
  return (key) => MESSAGES[lang][key]
}

export function isMessageKey(key: string): key is MessageKey {
  return key in en
}

const STORAGE_KEY = 'lang'

export function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'fr') return stored
  } catch {
    // Storage can be blocked; fall back to the browser language.
  }
  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

export function rememberLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Not remembered when storage is blocked.
  }
}

export const LangContext = createContext<{ lang: Lang; t: Translate }>({ lang: 'en', t: translator('en') })

export function useI18n() {
  return useContext(LangContext)
}
