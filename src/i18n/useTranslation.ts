import { useStore } from '../store/useStore';
import { translations, Language, Translations } from './translations';
import { Category } from '../types';

export const CATEGORY_TRANSLATIONS: Record<string, { name: { ar: string; en: string }; description: { ar: string; en: string } }> = {
  'timepieces': {
    name: { ar: 'الساعات الفاخرة', en: 'Haute Horology' },
    description: {
      ar: 'دقة ميكانيكية، زجاج ياقوتي، وحرفية ساعات جنيفية متوارثة.',
      en: 'Mechanical precision, sapphire crystals, and horological craftsmanship.',
    },
  },
  'audio-engineering': {
    name: { ar: 'الهندسة الصوتية', en: 'Acoustic Science' },
    description: {
      ar: 'نقاء صوتي فائق، مشغلات بلانار مغناطيسية، وهياكل ألومنيوم مصقولة.',
      en: 'Acoustic fidelity, beryllium drivers, and machined aluminum enclosures.',
    },
  },
  'minimalist-leather': {
    name: { ar: 'المصنوعات الجلدية', en: 'Tuscan Leathercraft' },
    description: {
      ar: 'جلود طبيعية مدبوغة نباتياً، حواف مصقولة يدوياً، وإكسسوارات معمرة.',
      en: 'Full-grain vegetable-tanned hides, hand-burnished edges, and durable brass.',
    },
  },
  'architectural-workspace': {
    name: { ar: 'مساحات العمل المعمارية', en: 'Desktop Architecture' },
    description: {
      ar: 'خشب جوز طبيعي، ألومنيوم مؤكسد، وتجهيزات مكتبية متقدمة.',
      en: 'Solid walnut, anodized aluminum, and ergonomic desktop essentials.',
    },
  },
  'modern-optics': {
    name: { ar: 'البصريات المعاصرة', en: 'Modern Optics' },
    description: {
      ar: 'إطارات تيتانيوم يابانية، عدسات مستقطبة، وتصاميم هندسية رفيعة.',
      en: 'Japanese titanium frames, Carl Zeiss polarized lenses, and architectural silhouettes.',
    },
  },
  'technical-apparel': {
    name: { ar: 'الأزياء التقنية الراقية', en: 'Technical Apparel' },
    description: {
      ar: 'صوف ميرينو طبيعي، أغشية مقاومة للطقس، وقصات مفصلة مريحة.',
      en: 'Merino wool, weather-resistant membranes, and ergonomic tailored cuts.',
    },
  },
  'fine-accessories': {
    name: { ar: 'الإكسسوارات والمقتنيات', en: 'Fine Accessories' },
    description: {
      ar: 'أقلام هندسية فاخرة، أزرار أكمام معمارية، وأدوات حمل من التيتانيوم.',
      en: 'Machined pens, geometric cufflinks, and everyday titanium carry.',
    },
  },
  'objects-of-art': {
    name: { ar: 'التحف والأعمال الفنية', en: 'Objects of Art' },
    description: {
      ar: 'برونز مصبوب، أواني خزفية يدوية، ومنحوتات فنية ذات خطوط نقية.',
      en: 'Cast bronze, ceramic vessels, and minimalist sculptural accents.',
    },
  },
};

export const useTranslation = () => {
  const language = useStore((state) => state.language);
  const setLanguage = useStore((state) => state.setLanguage);
  const t: Translations = translations[language] || translations.ar;
  const isRtl = language === 'ar';

  const localizeCategory = (cat: Category): Category => {
    const localized = CATEGORY_TRANSLATIONS[cat.slug];
    if (!localized) return cat;
    return {
      ...cat,
      name: localized.name[language] || cat.name,
      description: localized.description[language] || cat.description,
    };
  };

  const getCategoryName = (slug: string, fallback: string): string => {
    const localized = CATEGORY_TRANSLATIONS[slug];
    if (localized) {
      return localized.name[language] || fallback;
    }
    return fallback;
  };

  return { t, language, setLanguage, isRtl, localizeCategory, getCategoryName };
};

