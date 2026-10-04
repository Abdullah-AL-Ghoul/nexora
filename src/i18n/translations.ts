export type Language = 'ar' | 'en';

export interface Translations {
  // Common / Navigation
  nav: {
    collection: string;
    categories: string;
    trending: string;
    philosophy: string;
    wishlist: string;
    bag: string;
    searchPlaceholder: string;
    searchCancel: string;
    login: string;
    account: string;
    dashboard: string;
    logout: string;
    intelligence: string;
    openConsole: string;
    roleSwitcher: string;
    language: string;
  };
  // Hero Section
  hero: {
    badge: string;
    slide1Category: string;
    slide1Title: string;
    slide1Subtitle: string;
    slide2Category: string;
    slide2Title: string;
    slide2Subtitle: string;
    slide3Category: string;
    slide3Title: string;
    slide3Subtitle: string;
    ctaExplore: string;
    ctaLearnMore: string;
    guaranteeAuth: string;
    guaranteeSwiss: string;
    guaranteeFreight: string;
  };
  // Home Page
  home: {
    curatedTitle: string;
    curatedSubtitle: string;
    viewAllAteliers: string;
    trendingTitle: string;
    trendingSubtitle: string;
    exploreFullCatalog: string;
    bestSellersTitle: string;
    bestSellersSubtitle: string;
    manifestoTitle: string;
    manifestoTagline: string;
    manifestoP1: string;
    manifestoP2: string;
    stat1Label: string;
    stat2Label: string;
    stat3Label: string;
    newsletterTitle: string;
    newsletterSubtitle: string;
    newsletterPlaceholder: string;
    newsletterButton: string;
    newsletterSuccess: string;
  };
  // Shop Page
  shop: {
    title: string;
    subtitle: string;
    allCategories: string;
    searchLabel: string;
    searchPlaceholder: string;
    sortBy: string;
    sortNewest: string;
    sortPriceAsc: string;
    sortPriceDesc: string;
    sortPopular: string;
    resetFilters: string;
    artifactsFound: string;
    emptyTitle: string;
    emptyDescription: string;
    addToCart: string;
    quickView: string;
    options: string;
    onlyLeft: string;
  };
  // Product Detail Page
  product: {
    returnCatalog: string;
    notFoundTitle: string;
    notFoundDesc: string;
    returnCollection: string;
    specification: string;
    selectVariant: string;
    quantity: string;
    addToBag: string;
    inStock: string;
    outOfStock: string;
    insuredFreight: string;
    warranty: string;
    certifiedOrigin: string;
    specsTitle: string;
    placeOfOrigin: string;
    atelierDiscipline: string;
    skuLabel: string;
    dimensions: string;
    weight: string;
    materials: string;
    qualityStandard: string;
    serialVerification: string;
    relatedTitle: string;
    addedToBagToast: string;
  };
  // Cart Drawer
  cart: {
    title: string;
    emptyTitle: string;
    emptySubtitle: string;
    exploreArtifacts: string;
    itemsCount: string;
    subtotal: string;
    discount: string;
    shipping: string;
    complimentary: string;
    tax: string;
    total: string;
    couponPlaceholder: string;
    apply: string;
    couponApplied: string;
    checkoutButton: string;
    remove: string;
  };
  // Checkout Page
  checkout: {
    title: string;
    subtitle: string;
    shippingHeader: string;
    fullName: string;
    email: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    shippingMethod: string;
    methodExpress: string;
    methodStandard: string;
    paymentHeader: string;
    testNotice: string;
    cardNumber: string;
    cardExpiry: string;
    cardCvc: string;
    orderSummary: string;
    placeOrder: string;
    processing: string;
  };
  // Categories Page
  categories: {
    title: string;
    subtitle: string;
    exploreAtelier: string;
    artifactsCount: string;
  };
  // About Page
  about: {
    title: string;
    subtitle: string;
    heritageTitle: string;
    heritageText: string;
    pillarsTitle: string;
    pillar1Title: string;
    pillar1Text: string;
    pillar2Title: string;
    pillar2Text: string;
    pillar3Title: string;
    pillar3Text: string;
    exploreWorks: string;
  };
  // Orders Page
  orders: {
    title: string;
    subtitle: string;
    noOrdersTitle: string;
    noOrdersSubtitle: string;
    orderNumber: string;
    status: string;
    date: string;
    total: string;
    items: string;
  };
  // Wishlist Page
  wishlist: {
    title: string;
    subtitle: string;
    emptyTitle: string;
    emptySubtitle: string;
    browseCatalog: string;
  };
  // Dashboard
  dashboard: {
    title: string;
    suiteSubtitle: string;
    resetDemo: string;
    viewStorefront: string;
    tabOverview: string;
    tabProducts: string;
    tabCategories: string;
    tabOrders: string;
    tabInventory: string;
    tabUsers: string;
    addProduct: string;
    addCategory: string;
    searchProducts: string;
    searchOrders: string;
    revenue: string;
    ordersCount: string;
    avgOrder: string;
    lowStock: string;
    edit: string;
    delete: string;
    save: string;
    cancel: string;
    productName: string;
    price: string;
    comparePrice: string;
    stock: string;
    category: string;
    sku: string;
    tagline: string;
    description: string;
    imageUrl: string;
    actions: string;
  };
  // Login Page
  login: {
    signInTitle: string;
    registerTitle: string;
    signInSubtitle: string;
    registerSubtitle: string;
    googleSignIn: string;
    orWithEmail: string;
    fullName: string;
    email: string;
    password: string;
    signInBtn: string;
    registerBtn: string;
    alreadyHaveAccount: string;
    newCollector: string;
  };
  // Footer
  footer: {
    brandTagline: string;
    rights: string;
    explore: string;
    ateliers: string;
    legal: string;
    privacy: string;
    terms: string;
    provenance: string;
  };
}

export const translations: Record<Language, Translations> = {
  ar: {
    nav: {
      collection: 'التشكيلة الكاملة',
      categories: 'الأقسام والتصنيفات',
      trending: 'المنتجات الرائجة',
      philosophy: 'فلسفتنا وتراثنا',
      wishlist: 'المفضلة',
      bag: 'السلة',
      searchPlaceholder: 'ابحث عن الساعات، الجلود، الصوتيات، الأثاث...',
      searchCancel: 'إلغاء',
      login: 'تسجيل الدخول',
      account: 'حسابي',
      dashboard: 'الداش بورد',
      logout: 'تسجيل الخروج',
      intelligence: 'المعلومات الحية',
      openConsole: 'لوحة التحكم الإدارية',
      roleSwitcher: 'تبديل الدور التجريبي',
      language: 'English',
    },
    hero: {
      badge: 'إصدار فاخر محدود · أحدث الإبداعات',
      slide1Category: 'الساعات السويسرية الفاخرة',
      slide1Title: 'دقة لا متناهية في صياغة الوقت',
      slide1Subtitle: 'كرونوغرافات ميكانيكية مصنوعة يدوياً في جنيف بأعلى معايير الدقة الكرونومترية والصلب المعالج.',
      slide2Category: 'المصنوعات الجلدية الفرنسية',
      slide2Title: 'حرفية راسخة تدوم لأجيال',
      slide2Subtitle: 'جلود فرنسية مدبوغة عضوياً ومخيطة يدوياً بخيوط كتانية مشمعة لتكتسب سحراً فريداً مع الزمن.',
      slide3Category: 'الهندسة الصوتية والمساحات',
      slide3Title: 'نقاء صوتي وأثاث استثنائي',
      slide3Subtitle: 'شاشات صوتية بمغناطيسات بلانار وخشب الجوز الأمريكي الطبيعي لتجربة سمعية وبصرية فائقة.',
      ctaExplore: 'استكشف التشكيلة',
      ctaLearnMore: 'تعرف على فلسفتنا',
      guaranteeAuth: 'أصالة معتمدة 100%',
      guaranteeSwiss: 'معايير جودة سويسرية',
      guaranteeFreight: 'شحن أبيض مؤمن مجاناً',
    },
    home: {
      curatedTitle: 'أقسام الحرفية والتصاميم الرفيعة',
      curatedSubtitle: 'ثمانية تخصصات فنية تجسد قمة الابتكار والجمال الهندسي.',
      viewAllAteliers: 'استعراض كافة الأقسام',
      trendingTitle: 'المقتنيات الأكثر طلباً',
      trendingSubtitle: 'قطع استثنائية حازت على إعجاب وتقدير هواة الاقتناء هذا الموسم.',
      exploreFullCatalog: 'استعراض التشكيلة الكاملة',
      bestSellersTitle: 'الأعمال الخالدة والأكثر مبيعاً',
      bestSellersSubtitle: 'مقتنيات حصرية تشهد على جودة لا تنازل فيها وأصالة مستدامة.',
      manifestoTitle: 'فلسفة نكسورا: هندسة التحف الخالدة',
      manifestoTagline: '«نحن لا نصنع مجرد سلع، بل نبتكر تحفاً مقتناة تلهم الأجيال القادمة وتتحدى فناء الزمن.»',
      manifestoP1: 'تأسست نكسورا لتكون ملتقى الحرفيين المهرة والمصممين المعماريين، رافضةً مفهوم الاستهلاك السريع. كل قطعة في تشكيلتنا تُصنع بحسابات متناهية وتخضع لاختبارات صارمة.',
      manifestoP2: 'من سبائك التيتانيوم المستخدمة في الطيران إلى أخشاب الجوز وزيوت الدباغة الطبيعية، نختار المواد التي تزداد قيمة ورونقاً مع مرور السنين.',
      stat1Label: 'قطعة مقتناة حول العالم',
      stat2Label: 'حرفي وورشة عمل معتمدة',
      stat3Label: 'سنوات ضمان دولي شامل',
      newsletterTitle: 'انضم إلى سجل الهواة المتميزين',
      newsletterSubtitle: 'احصل على إشعارات مسبقة بالإصدارات المحدودة ومقالات حصرية عن الحرفية النادرة.',
      newsletterPlaceholder: 'أدخل بريدك الإلكتروني...',
      newsletterButton: 'اشتراك بالخاص',
      newsletterSuccess: 'تم تسجيلك بنجاح في السجل الخاص.',
    },
    shop: {
      title: 'التشكيلة الكاملة للمقتنيات الفاخرة',
      subtitle: 'استكشف الساعات الميكانيكية، المصنوعات الجلدية، الشاشات الصوتية، وأدوات الكتابة الاستثنائية.',
      allCategories: 'كافة التصنيفات',
      searchLabel: 'البحث:',
      searchPlaceholder: 'ابحث بالاسم أو الرمز أو الوصف...',
      sortBy: 'الترتيب حسب:',
      sortNewest: 'الأحدث أولاً',
      sortPriceAsc: 'السعر: من الأقل للأعلى',
      sortPriceDesc: 'السعر: من الأعلى للأقل',
      sortPopular: 'الأكثر شعبية',
      resetFilters: 'إعادة ضبط الفلاتر',
      artifactsFound: 'قطعة متوفرة',
      emptyTitle: 'لا توجد قطع مطابقة للبحث',
      emptyDescription: 'لم نتمكن من العثور على أي أعمال تطابق معايير التصفية الحالية. يرجى تجربة كلمات بحث أخرى.',
      addToCart: 'إضافة للسلة',
      quickView: 'معاينة سريعة',
      options: 'خيارات',
      onlyLeft: 'متبقي فقط',
    },
    product: {
      returnCatalog: 'العودة إلى التشكيلة',
      notFoundTitle: 'القطعة غير موجودة',
      notFoundDesc: 'الرابط المطلوب غير متوفر أو تم سحب القطعة من السجل الرسمي.',
      returnCollection: 'العودة للمتجر',
      specification: 'المواصفات المختارة',
      selectVariant: 'اختر المواصفات:',
      quantity: 'الكمية المطلوبة:',
      addToBag: 'إضافة إلى حقيبة التسوق',
      inStock: 'متوفر وجاهز للشحن',
      outOfStock: 'نفد من المخزون',
      insuredFreight: 'شحن أبيض مؤمن',
      warranty: 'ضمان دولي 5 سنوات',
      certifiedOrigin: 'شهادة منشأ أصلي',
      specsTitle: 'المواصفات الفنية وسند المنشأ',
      placeOfOrigin: 'مكان المنشأ والتصنيع',
      atelierDiscipline: 'التخصص الحرفي',
      skuLabel: 'رمز المنتج المسجل (SKU)',
      dimensions: 'الأبعاد الدقيقة',
      weight: 'الوزن الصافي',
      materials: 'تركيبة المواد الفاخرة',
      qualityStandard: 'معيار الجودة المعتمد',
      serialVerification: 'التحقق التسلسلي بالليزر',
      relatedTitle: 'أعمال حرفية مكملة ومقترحة',
      addedToBagToast: 'تمت إضافة القطعة بنجاح إلى حقيبة التسوق.',
    },
    cart: {
      title: 'حقيبة التسوق',
      emptyTitle: 'حقيبة التسوق فارغة',
      emptySubtitle: 'لم تقم بإضافة أي مقتنيات إلى حقيبتك بعد. استكشف التشكيلة واقتنِ ما يناسب ذوقك.',
      exploreArtifacts: 'استكشف التشكيلة',
      itemsCount: 'عناصر',
      subtotal: 'المجموع الفرعي',
      discount: 'الخصم المطبق',
      shipping: 'الشحن والتوصيل',
      complimentary: 'شحن مجاني مؤمن',
      tax: 'الضريبة التقديرية',
      total: 'الإجمالي النهائي',
      couponPlaceholder: 'رمز القسيمة (مثال: NEXORA10)',
      apply: 'تطبيق',
      couponApplied: 'تم تطبيق الكوبون بنجاح!',
      checkoutButton: 'المتابعة لإتمام الطلب',
      remove: 'حذف',
    },
    checkout: {
      title: 'إتمام الطلب والشحن الفاخر',
      subtitle: 'أدخل تفاصيل التوصيل لإصدار إشعار الشحن الأبيض المؤمن.',
      shippingHeader: '1. عنوان الشحن والتسليم',
      fullName: 'الاسم الكامل',
      email: 'البريد الإلكتروني',
      street: 'العنوان / الشارع والحي',
      city: 'المدينة',
      state: 'المنطقة / المقاطعة',
      postalCode: 'الرمز البريدي',
      country: 'الدولة',
      shippingMethod: '2. طريقة الشحن الأبيض الفاخر',
      methodExpress: 'شحن نكسورا السريع الأبيض (مؤمن بالكامل - يومين عمل)',
      methodStandard: 'شحن الحفظ القياسي (مؤمن - 3 إلى 5 أيام)',
      paymentHeader: '3. بيانات الدفع (Stripe Test Mode)',
      testNotice: 'نظام الدفع في وضع الاختبار الآمن. يمكنك استخدام بطاقة اختبار Stripe (4242...).',
      cardNumber: 'رقم البطاقة',
      cardExpiry: 'تاريخ الانتهاء (MM/YY)',
      cardCvc: 'رمز الأمان (CVC)',
      orderSummary: 'ملخص الطلب والمقتنيات',
      placeOrder: 'تأكيد ودفع الطلب الآن',
      processing: 'جاري معالجة وتأمين الطلب...',
    },
    categories: {
      title: 'الأقسام والتخصصات الحرفية',
      subtitle: 'استكشف بيوت الحرفة المتخصصة في صياغة أدوات الحياة الفاخرة.',
      exploreAtelier: 'استعراض مقتنيات القسم',
      artifactsCount: 'قطع معتمدة',
    },
    about: {
      title: 'فلسفة نكسورا وتراث الإتقان',
      subtitle: 'حيث تلتقي عراقة الحرفة اليدوية بالدقة الهندسية المتطورة.',
      heritageTitle: 'التزام مطلق بالأصالة الخالدة',
      heritageText: 'في عصر يطغى عليه الإنتاج السريع والاستهلاك المؤقت، تأسست منصة نكسورا لتكون ملاذاً للباحثين عن الاستدامة والجمال الحقيقي. كل عمل نعرضه يمر بسلسلة تدقيق تضمن استخدام خامات طبيعية رفيعة ومعايير ضبط صارمة.',
      pillarsTitle: 'ركائزنا الجوهرية',
      pillar1Title: '1. الدقة الهندسية السويسرية',
      pillar1Text: 'التعامل مع الوقت كفن معماري خالص، حيث تصنع التروس والحركات الميكانيكية بمليمترات دقيقة.',
      pillar2Title: '2. الدباغة النباتية الطبيعية',
      pillar2Text: 'جلود فرنسية وأمريكية معالجة بمستخلصات لحاء الشجر، تتنفس وتزداد جمالاً مع مرور السنوات.',
      pillar3Title: '3. الهدوء الصوتي والمعماري',
      pillar3Text: 'تصاميم مكتبية وأجهزة صوتية بلانار صممت لتمنح مساحتك الخاصة سكوناً وصفاءً لا مثيل له.',
      exploreWorks: 'استكشف جميع الأعمال المقتناة',
    },
    orders: {
      title: 'سجل الطلبات والتتبع',
      subtitle: 'استعرض تاريخ مقتنياتك وحالة الشحن المباشر عبر الشحن الأبيض.',
      noOrdersTitle: 'لا توجد طلبات مسجلة بعد',
      noOrdersSubtitle: 'عند إتمام أي عملية اقتناء، ستظهر تفاصيل الشحنة والتتبع في هذا السجل الخاص.',
      orderNumber: 'رقم الطلب',
      status: 'حالة الطلب',
      date: 'تاريخ الطلب',
      total: 'المبلغ الإجمالي',
      items: 'المقتنيات',
    },
    wishlist: {
      title: 'قائمة المقتنيات المفضلة',
      subtitle: 'الأعمال والقطع التي قمت بحفظها لاستعراضها واقتنائها لاحقاً.',
      emptyTitle: 'قائمة المفضلة فارغة',
      emptySubtitle: 'اضغط على رمز القلب عند أي منتج لحفظه في قائمة رغباتك الخاصة.',
      browseCatalog: 'تصفح التشكيلة الآن',
    },
    dashboard: {
      title: 'منصة إدارة نكسورا (Console)',
      suiteSubtitle: 'مركز التحكم والعمليات: إدارة المنتجات، الأقسام، المخزون، والطلبات.',
      resetDemo: 'إعادة ضبط البيانات الافتراضية',
      viewStorefront: 'معاينة المتجر للعملاء',
      tabOverview: 'نظرة عامة والتحليلات',
      tabProducts: 'المنتجات والكتالوج',
      tabCategories: 'الأقسام والتصنيفات',
      tabOrders: 'إدارة الطلبات والشحن',
      tabInventory: 'سجل المخزون والعمليات',
      tabUsers: 'المستخدمين والصلاحيات',
      addProduct: '+ إضافة منتج جديد',
      addCategory: '+ إضافة قسم جديد',
      searchProducts: 'بحث في المنتجات بالاسم أو SKU...',
      searchOrders: 'بحث في الطلبات بالرقم أو اسم العميل...',
      revenue: 'إجمالي المبيعات المحققة',
      ordersCount: 'إجمالي الطلبات المسجلة',
      avgOrder: 'متوسط قيمة الطلب',
      lowStock: 'تنبيهات انخفاض المخزون',
      edit: 'تعديل',
      delete: 'حذف',
      save: 'حفظ التغييرات',
      cancel: 'إلغاء',
      productName: 'اسم المنتج',
      price: 'السعر ($ USD)',
      comparePrice: 'السعر قبل الخصم',
      stock: 'المخزون',
      category: 'القسم / التصنيف',
      sku: 'رمز المنتج (SKU)',
      tagline: 'نبذة قصيرة',
      description: 'الوصف الكامل',
      imageUrl: 'رابط الصورة (URL)',
      actions: 'الإجراءات',
    },
    login: {
      signInTitle: 'تسجيل الدخول إلى حسابك',
      registerTitle: 'إنشاء حساب جامع جديد',
      signInSubtitle: 'أدخل بياناتك للوصول إلى مقتنياتك أو لوحة التحكم الإدارية.',
      registerSubtitle: 'انضم إلى سجل الهواة لمتابعة طلباتك والحصول على أولوية الشحن.',
      googleSignIn: 'تسجيل الدخول عبر Google',
      orWithEmail: 'أو بواسطة البريد الإلكتروني',
      fullName: 'الاسم الكامل',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      signInBtn: 'تسجيل الدخول',
      registerBtn: 'إنشاء الحساب الآن',
      alreadyHaveAccount: 'لديك حساب بالفعل؟ تسجيل الدخول',
      newCollector: 'مستخدم جديد؟ إنشاء حساب الآن',
    },
    footer: {
      brandTagline: 'منصة التجارة الإلكترونية المعمارية للمقتنيات والأعمال الحرفية الفاخرة.',
      rights: 'جميع الحقوق محفوظة لمنصة نكسورا.',
      explore: 'استكشف',
      ateliers: 'الأقسام الحرفية',
      legal: 'الشروط والضمان',
      privacy: 'سياسة الخصوصية',
      terms: 'شروط الاقتناء',
      provenance: 'شهادة المنشأ',
    },
  },
  en: {
    nav: {
      collection: 'Collection',
      categories: 'Ateliers & Categories',
      trending: 'Trending',
      philosophy: 'Philosophy',
      wishlist: 'Wishlist',
      bag: 'Bag',
      searchPlaceholder: 'Search timepieces, leather, audio, workspace...',
      searchCancel: 'Cancel',
      login: 'Sign In',
      account: 'Account',
      dashboard: 'Dashboard',
      logout: 'Sign Out',
      intelligence: 'Intelligence',
      openConsole: 'Management Console',
      roleSwitcher: 'Switch Role',
      language: 'العربية',
    },
    hero: {
      badge: 'Limited Commission · Latest Arrivals',
      slide1Category: 'Swiss Horological Craft',
      slide1Title: 'Mechanical Precision in Pure Steel',
      slide1Subtitle: 'Chronometric timepieces hand-assembled in Geneva with surgical 316L steel and sapphire crystal.',
      slide2Category: 'French Vegetable-Tanned Leather',
      slide2Title: 'Enduring Craft for Generations',
      slide2Subtitle: 'Organic vegetable-tanned French hides saddle-stitched with waxed linen thread to develop patina over decades.',
      slide3Category: 'Acoustic Architecture & Workspace',
      slide3Title: 'Planar Monitors & Natural Walnut',
      slide3Subtitle: 'Planar magnetic transducers and solid American walnut enclosures for the uncompromising listening room.',
      ctaExplore: 'Explore Collection',
      ctaLearnMore: 'Our Philosophy',
      guaranteeAuth: '100% Guaranteed Authenticity',
      guaranteeSwiss: 'Swiss Certified Standard',
      guaranteeFreight: 'White-Glove Insured Freight',
    },
    home: {
      curatedTitle: 'Curated Ateliers & Disciplines',
      curatedSubtitle: 'Eight distinct artisan fields representing the pinnacle of industrial craft and architecture.',
      viewAllAteliers: 'View All Ateliers',
      trendingTitle: 'Curated Acquisitions',
      trendingSubtitle: 'Exceptional artifacts commanding high collector interest this season.',
      exploreFullCatalog: 'Explore Complete Catalog',
      bestSellersTitle: 'Enduring Masterworks',
      bestSellersSubtitle: 'Flagship pieces that define the NEXORA standard of permanence and aesthetic gravity.',
      manifestoTitle: 'The NEXORA Manifesto: Beyond Ephemeral Objects',
      manifestoTagline: '“We reject built-in obsolescence. Every artifact is made to outlast its custodian.”',
      manifestoP1: 'NEXORA was established as a counterbalance to disposable consumer technology and fast fashion. We commission, engineer, and curate physical objects that command permanence.',
      manifestoP2: 'From aerospace titanium to slow-tanned leathers and oil-rubbed hardwoods, we select materials that improve with honest use rather than deteriorate.',
      stat1Label: 'Acquisitions Delivered Globally',
      stat2Label: 'Guild Artisans & Master Ateliers',
      stat3Label: 'Years Comprehensive Guarantee',
      newsletterTitle: 'Join the Private Dispatch',
      newsletterSubtitle: 'Receive advance notice of limited releases, private reserve commissions, and horological dispatches.',
      newsletterPlaceholder: 'Enter your email address...',
      newsletterButton: 'Subscribe',
      newsletterSuccess: 'Thank you. You have been registered in the private archive.',
    },
    shop: {
      title: 'The Permanent Collection',
      subtitle: 'Browse Swiss mechanical chronographs, Parisian leather goods, planar monitors, and precision writing instruments.',
      allCategories: 'All Categories',
      searchLabel: 'Search:',
      searchPlaceholder: 'Search by name, SKU, or craft description...',
      sortBy: 'Sort by:',
      sortNewest: 'Newest Arrivals',
      sortPriceAsc: 'Price: Low to High',
      sortPriceDesc: 'Price: High to Low',
      sortPopular: 'Most Popular',
      resetFilters: 'Reset Filters',
      artifactsFound: 'Artifacts Available',
      emptyTitle: 'No Matching Artifacts in Collection',
      emptyDescription: 'No artifacts match your selected filter criteria. Try adjusting your search or clearing active filters.',
      addToCart: 'Add to Bag',
      quickView: 'Quick View',
      options: 'options',
      onlyLeft: 'Only',
    },
    product: {
      returnCatalog: 'Return to Catalog',
      notFoundTitle: 'Artifact Not Found',
      notFoundDesc: 'The requested artifact reference does not exist or has been retired from the registry.',
      returnCollection: 'Return to Collection',
      specification: 'Selected Specification',
      selectVariant: 'Select Specification:',
      quantity: 'Quantity:',
      addToBag: 'Add to Shopping Bag',
      inStock: 'In Stock & Ready for Dispatch',
      outOfStock: 'Sold Out',
      insuredFreight: 'Insured Freight',
      warranty: '5-Yr Global Warranty',
      certifiedOrigin: 'Certified Origin',
      specsTitle: 'Architectural Specifications & Provenance',
      placeOfOrigin: 'Place of Origin',
      atelierDiscipline: 'Atelier Discipline',
      skuLabel: 'Production SKU',
      dimensions: 'Dimensions',
      weight: 'Net Weight',
      materials: 'Materials Compounding',
      qualityStandard: 'Quality Standard',
      serialVerification: 'Laser-Etched Serial Verification',
      relatedTitle: 'Harmonious Complementary Artifacts',
      addedToBagToast: 'Artifact added to shopping bag successfully.',
    },
    cart: {
      title: 'Shopping Bag',
      emptyTitle: 'Your Bag is Empty',
      emptySubtitle: 'You have not added any commissioned works to your bag yet. Explore our ateliers to begin.',
      exploreArtifacts: 'Explore Collection',
      itemsCount: 'items',
      subtotal: 'Subtotal',
      discount: 'Applied Discount',
      shipping: 'Insured Freight',
      complimentary: 'Complimentary Insured',
      tax: 'Estimated Tax',
      total: 'Total Acquisition Value',
      couponPlaceholder: 'Promotional code (e.g. NEXORA10)',
      apply: 'Apply',
      couponApplied: 'Promotional code applied successfully!',
      checkoutButton: 'Proceed to Secure Checkout',
      remove: 'Remove',
    },
    checkout: {
      title: 'Commission Fulfillment & Checkout',
      subtitle: 'Enter your delivery destination to initiate insured white-glove consignment.',
      shippingHeader: '1. Consignment Address',
      fullName: 'Full Name',
      email: 'Email Address',
      street: 'Street Address',
      city: 'City',
      state: 'State / Province',
      postalCode: 'Postal / ZIP Code',
      country: 'Country',
      shippingMethod: '2. White-Glove Shipping Method',
      methodExpress: 'NEXORA Express Courier (Insured · 2 Business Days)',
      methodStandard: 'Standard Insured Freight (3-5 Business Days)',
      paymentHeader: '3. Payment Verification (Stripe Test Mode)',
      testNotice: 'Payment gateway operating in secure test sandbox. You may use Stripe test cards (4242...).',
      cardNumber: 'Card Number',
      cardExpiry: 'Expiry Date (MM/YY)',
      cardCvc: 'CVC Security Code',
      orderSummary: 'Order Acquisition Summary',
      placeOrder: 'Confirm & Authorize Order',
      processing: 'Authorizing Transaction...',
    },
    categories: {
      title: 'Ateliers & Craft Disciplines',
      subtitle: 'Explore our eight independent workshops dedicated to permanent, tactile masterworks.',
      exploreAtelier: 'Explore Atelier Collection',
      artifactsCount: 'Commissioned Artifacts',
    },
    about: {
      title: 'The Philosophy of Permanence',
      subtitle: 'Where timeless artisanal heritage converges with uncompromising modern engineering.',
      heritageTitle: 'An Absolute Commitment to Authenticity',
      heritageText: 'In an era dominated by rapid manufacturing and planned obsolescence, NEXORA was founded to curate objects that improve with age. Every piece we deliver is rigorously vetted for authentic origin and superior materials.',
      pillarsTitle: 'Our Foundational Pillars',
      pillar1Title: '1. Swiss Chronometric Precision',
      pillar1Text: 'Treating time as pure architectural geometry, where gear trains and balance springs operate with micron tolerances.',
      pillar2Title: '2. French Vegetable-Tanned Leathers',
      pillar2Text: 'Full-grain leathers treated with tree-bark extracts that breathe, soften, and darken into a lustrous patina.',
      pillar3Title: '3. Acoustic & Tactile Serenity',
      pillar3Text: 'Planar magnetic transducers and solid hardwood enclosures designed to bring stillness and sonic fidelity to your sanctum.',
      exploreWorks: 'Explore All Commissioned Works',
    },
    orders: {
      title: 'Order History & Consignment Ledger',
      subtitle: 'Review your acquired works, tracking numbers, and real-time transit status.',
      noOrdersTitle: 'No Orders Registered',
      noOrdersSubtitle: 'When you commission an artifact, its tracking details and white-glove freight receipt will be recorded here.',
      orderNumber: 'Order Number',
      status: 'Status',
      date: 'Order Date',
      total: 'Total Value',
      items: 'Acquired Items',
    },
    wishlist: {
      title: 'Curated Wishlist',
      subtitle: 'Saved artifacts reserved for your future commission or acquisition.',
      emptyTitle: 'Your Wishlist is Empty',
      emptySubtitle: 'Click the heart icon on any artifact card to preserve it in your private registry.',
      browseCatalog: 'Explore Catalog Now',
    },
    dashboard: {
      title: 'NEXORA Management Console',
      suiteSubtitle: 'Central operations center for managing products, categories, orders, and inventory.',
      resetDemo: 'Reset Demo State',
      viewStorefront: 'View Storefront',
      tabOverview: 'Overview & KPIs',
      tabProducts: 'Products & Catalog',
      tabCategories: 'Ateliers & Categories',
      tabOrders: 'Orders & Fulfillment',
      tabInventory: 'Inventory Ledger',
      tabUsers: 'Users & RBAC',
      addProduct: '+ Commission New Product',
      addCategory: '+ Add New Atelier',
      searchProducts: 'Search products by name, SKU, or category...',
      searchOrders: 'Search orders by ID, customer name, or email...',
      revenue: 'Gross Commission Revenue',
      ordersCount: 'Total Orders Logged',
      avgOrder: 'Average Commission Value',
      lowStock: 'Critical Low Stock Alerts',
      edit: 'Edit',
      delete: 'Delete',
      save: 'Save to Registry',
      cancel: 'Cancel',
      productName: 'Artifact Name',
      price: 'Price ($ USD)',
      comparePrice: 'Compare Price ($ USD)',
      stock: 'Stock Count',
      category: 'Atelier Discipline',
      sku: 'SKU Code',
      tagline: 'Tagline',
      description: 'Full Description',
      imageUrl: 'Product Image (URL)',
      actions: 'Actions',
    },
    login: {
      signInTitle: 'Collector Authentication',
      registerTitle: 'Create Atelier Account',
      signInSubtitle: 'Enter your credentials to access your acquired works or management console.',
      registerSubtitle: 'Join the private registry for horology dispatches and commission tracking.',
      googleSignIn: 'Continue with Google',
      orWithEmail: 'Or With Email',
      fullName: 'Full Name',
      email: 'Email Address',
      password: 'Password',
      signInBtn: 'Access Vault',
      registerBtn: 'Create Account',
      alreadyHaveAccount: 'Already registered? Sign In',
      newCollector: 'New collector? Create an account',
    },
    footer: {
      brandTagline: 'Architectural luxury e-commerce platform engineered for permanent physical masterworks.',
      rights: 'All rights reserved. NEXORA Atelier.',
      explore: 'Explore',
      ateliers: 'Ateliers',
      legal: 'Legal & Warranty',
      privacy: 'Privacy Policy',
      terms: 'Terms of Commission',
      provenance: 'Provenance Guarantee',
    },
  },
};
