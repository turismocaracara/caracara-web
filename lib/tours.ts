export type TourCategory = 'cajon' | 'valparaiso' | 'santiago' | 'vinedos' | 'trekking' | 'aventura';
export type TourDifficulty = 'low' | 'medium' | 'high';

export interface Tour {
  slug: string;
  category: TourCategory;
  durationHours: number;
  maxPax: number;
  price: number | null; // null = consultar
  difficulty: TourDifficulty;
  highlights: string[];
  wineConvenios?: string[];
}

export const TOURS: Tour[] = [
  // --- CAJÓN DEL MAIPO ---
  { slug: 'embalse-el-yeso', category: 'cajon', durationHours: 9, maxPax: 9, price: null, difficulty: 'medium', highlights: ['embalse_yeso', 'laguna_turquesa', 'andes_view', 'lunch_included'] },
  { slug: 'el-yeso-las-melosas', category: 'cajon', durationHours: 10, maxPax: 9, price: null, difficulty: 'medium', highlights: ['embalse_yeso', 'las_melosas', 'two_destinations', 'lunch_included'] },
  { slug: 'el-yeso-termas-colina', category: 'cajon', durationHours: 11, maxPax: 9, price: null, difficulty: 'high', highlights: ['embalse_yeso', 'thermal_pools', 'andes_view', 'lunch_included'] },
  { slug: 'cajon-del-maipo-panoramico', category: 'cajon', durationHours: 8, maxPax: 9, price: null, difficulty: 'low', highlights: ['san_jose_volcano', 'maipo_river', 'villages', 'lunch_included'] },
  { slug: 'termas-valle-colina', category: 'cajon', durationHours: 11, maxPax: 9, price: null, difficulty: 'high', highlights: ['thermal_pools', 'mountain_scenery', 'relax', 'lunch_included'] },
  // --- VALPARAÍSO ---
  { slug: 'valparaiso-vina-del-mar', category: 'valparaiso', durationHours: 9, maxPax: 9, price: null, difficulty: 'low', highlights: ['cerros_valpo', 'street_art', 'vina_beach', 'lunch_included'] },
  { slug: 'valparaiso-vinedo', category: 'valparaiso', durationHours: 10, maxPax: 9, price: null, difficulty: 'low', highlights: ['cerros_valpo', 'wine_tasting', 'casablanca_valley', 'lunch_included'] },
  { slug: 'isla-negra-undurraga', category: 'valparaiso', durationHours: 10, maxPax: 9, price: null, difficulty: 'low', highlights: ['pablo_neruda_house', 'undurraga_winery', 'sea_views', 'lunch_included'] },
  { slug: 'valparaiso-casas-del-bosque', category: 'valparaiso', durationHours: 10, maxPax: 9, price: null, difficulty: 'low', highlights: ['cerros_valpo', 'casas_bosque_winery', 'casablanca_valley', 'lunch_included'] },
  // --- SANTIAGO ---
  { slug: 'andes-panoramico', category: 'santiago', durationHours: 7, maxPax: 9, price: null, difficulty: 'medium', highlights: ['farellones_village', 'andes_views', 'snow_optional', 'snack_included'] },
  { slug: 'city-tour-santiago', category: 'santiago', durationHours: 6, maxPax: 9, price: null, difficulty: 'low', highlights: ['plaza_de_armas', 'santa_lucia', 'barrio_italia', 'snack_included'] },
  // --- VIÑEDOS ---
  { slug: 'tour-casablanca', category: 'vinedos', durationHours: 9, maxPax: 9, price: null, difficulty: 'low', highlights: ['casablanca_valley', 'sauvignon_blanc', 'pinot_noir', 'lunch_included'], wineConvenios: ['Casas del Bosque', 'Emiliana', 'Viñamar', 'Kingston Family', 'Odfjell', 'Villard'] },
  { slug: 'tour-premium', category: 'vinedos', durationHours: 10, maxPax: 9, price: null, difficulty: 'low', highlights: ['top_wineries', 'premium_tasting', 'gourmet_lunch', 'cellar_tour'], wineConvenios: ['Cousiño Macul', 'Clos Apalta', 'Matetic', 'Aquitania'] },
  { slug: 'tour-colchagua', category: 'vinedos', durationHours: 12, maxPax: 9, price: null, difficulty: 'low', highlights: ['colchagua_valley', 'carmenere', 'santa_cruz_town', 'lunch_included'], wineConvenios: ['Clos Apalta', 'Casa Silva'] },
  { slug: 'tour-santa-rita', category: 'vinedos', durationHours: 8, maxPax: 9, price: null, difficulty: 'low', highlights: ['santa_rita_estate', 'museum_tour', 'premium_tasting', 'lunch_included'], wineConvenios: ['Santa Rita'] },
  { slug: 'tour-santiago-wines', category: 'vinedos', durationHours: 8, maxPax: 9, price: null, difficulty: 'low', highlights: ['santiago_wineries', 'cousino_macul', 'undurraga', 'lunch_included'], wineConvenios: ['Cousiño Macul', 'Undurraga'] },
  { slug: 'sunset-alyan', category: 'vinedos', durationHours: 7, maxPax: 9, price: null, difficulty: 'low', highlights: ['sunset_views', 'wine_tasting', 'intimate_experience', 'snack_included'] },
  // --- TREKKING ---
  { slug: 'mirador-condores', category: 'trekking', durationHours: 8, maxPax: 9, price: null, difficulty: 'medium', highlights: ['condor_sighting', 'mountain_trail', 'andes_panorama', 'lunch_included'] },
  { slug: 'glaciar-el-morado', category: 'trekking', durationHours: 10, maxPax: 9, price: null, difficulty: 'high', highlights: ['glacier_trek', 'mountain_lake', 'andes_scenery', 'lunch_included'] },
  { slug: 'laguna-del-inca', category: 'trekking', durationHours: 10, maxPax: 9, price: null, difficulty: 'high', highlights: ['inca_lagoon', 'andean_altitude', 'border_scenery', 'lunch_included'] },
  { slug: 'parque-la-campana', category: 'trekking', durationHours: 9, maxPax: 9, price: null, difficulty: 'medium', highlights: ['darwin_trail', 'native_forest', 'palma_chilena', 'lunch_included'] },
  { slug: 'lagunillas-rafting', category: 'trekking', durationHours: 10, maxPax: 9, price: null, difficulty: 'high', highlights: ['hiking', 'rafting_combo', 'maipo_river', 'lunch_included'] },
  // --- AVENTURA ---
  { slug: 'rafting-asado', category: 'aventura', durationHours: 8, maxPax: 9, price: null, difficulty: 'medium', highlights: ['maipo_rafting', 'traditional_asado', 'adrenaline', 'full_day'] },
  { slug: 'cabalgata-lo-barnechea', category: 'aventura', durationHours: 5, maxPax: 9, price: null, difficulty: 'low', highlights: ['horseback_riding', 'andean_foothills', 'andes_views', 'snack_included'] },
  { slug: 'parque-farellones', category: 'aventura', durationHours: 8, maxPax: 9, price: null, difficulty: 'medium', highlights: ['farellones_park', 'zip_line', 'mountain_biking', 'lunch_included'] },
];

export const CATEGORIES: TourCategory[] = ['cajon', 'valparaiso', 'santiago', 'vinedos', 'trekking', 'aventura'];

export function getTourBySlug(slug: string): Tour | undefined {
  return TOURS.find((t) => t.slug === slug);
}

export function getToursByCategory(category: TourCategory): Tour[] {
  return TOURS.filter((t) => t.category === category);
}
