/**
 * LiquorFlow - Centralized Localization (Marathi, Hindi, English)
 * Requirement 24: Language Foundation
 */

import { SupportedLanguage } from '../types';

export interface TranslationDictionary {
  appName: string;
  appTagline: string;
  
  // Navigation & Header
  navDashboard: string;
  navInventory: string;
  navProducts: string;
  navBrands: string;
  navPackSizes: string;
  navPurchases: string;
  navSales: string;
  navReports: string;
  navSettings: string;
  navLogout: string;
  searchPlaceholder: string;
  globalSearchHint: string;

  // Setup Screen
  setupHeading: string;
  setupSubheading: string;
  businessInfoSection: string;
  businessNameLabel: string;
  businessNamePlaceholder: string;
  addressLabel: string;
  addressPlaceholder: string;
  ownerMobileLabel: string;
  ownerMobilePlaceholder: string;
  vatLabel: string;
  vatPlaceholder: string;
  licenceLabel: string;
  licencePlaceholder: string;
  credentialsSection: string;
  loginMobileLabel: string;
  loginMobilePlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  confirmPasswordLabel: string;
  confirmPasswordPlaceholder: string;
  languageSelectLabel: string;
  completeSetupButton: string;
  settingUp: string;

  // Login Screen
  loginHeading: string;
  loginSubheading: string;
  loginButton: string;
  loggingIn: string;
  invalidCredentialsAlert: string;
  setupRequiredNotice: string;
  goToSetup: string;

  // Dashboard & KPIs
  todaysSales: string;
  todaysPurchases: string;
  currentStock: string;
  stockValuation: string;
  totalProducts: string;
  lowStockAlert: string;
  categoryWiseStock: string;
  salesSummary: string;
  purchaseSummary: string;
  recentTransactions: string;
  quickActions: string;
  newSale: string;
  newPurchase: string;
  addOpeningStock: string;
  units: string;
  rupeesSymbol: string;

  // Configuration / Environment
  configErrorHeading: string;
  configErrorSubheading: string;
  missingVariablesNotice: string;
  recheckConnection: string;
  viewMigrationGuide: string;

  // Masters Management
  productsTitle: string;
  addProduct: string;
  editProduct: string;
  deleteProduct: string;
  productName: string;
  category: string;
  brand: string;
  packSize: string;
  packType: string;
  sku: string;
  purchasePrice: string;
  sellingPrice: string;
  mrp: string;
  status: string;
  complianceRef: string;
  openingStock: string;
  actions: string;
  searchProducts: string;
  allCategories: string;
  allBrands: string;
  allStatus: string;
  
  brandsTitle: string;
  addBrand: string;
  editBrand: string;
  brandName: string;
  maharashtraStatus: string;
  regReference: string;
  searchBrands: string;

  packSizesTitle: string;
  addPackSize: string;
  editPackSize: string;
  packSizeName: string;
  volumeMl: string;
  searchPackSizes: string;

  // Pagination & Common Actions
  showing: string;
  of: string;
  previous: string;
  next: string;
  activate: string;
  deactivate: string;
  confirmDeactivateTitle: string;
  confirmDeactivateMsg: string;
  confirmDeleteTitle: string;
  confirmDeleteMsg: string;

  // Common
  save: string;
  cancel: string;
  close: string;
  loading: string;
  success: string;
  error: string;
  active: string;
  inactive: string;
  noDataFound: string;
}

export const translations: Record<SupportedLanguage, TranslationDictionary> = {
  mr: {
    appName: 'लिकरफ्लो',
    appTagline: 'मद्य दुकान व बार इन्व्हेंटरी आणि ईआरपी प्रणाली',

    // Navigation
    navDashboard: 'डॅशबोर्ड',
    navInventory: 'इन्व्हेंटरी',
    navProducts: 'उत्पादने (Products)',
    navBrands: 'ब्रँड्स (Brands)',
    navPackSizes: 'पॅक साईज (Pack Sizes)',
    navPurchases: 'खरेदी (Inward)',
    navSales: 'विक्री (POS)',
    navReports: 'अहवाल (Reports)',
    navSettings: 'सेटिंग्ज',
    navLogout: 'लॉग आऊट',
    searchPlaceholder: 'उत्पादन, ब्रँड, SKU किंवा बिल शोधा... (Ctrl+K)',
    globalSearchHint: 'शोधण्यासाठी Ctrl + K किंवा / दाबा',

    // Setup
    setupHeading: 'Welcome to LiquorFlow',
    setupSubheading: "Let's set up your business before you start.",
    businessInfoSection: 'व्यवसाय माहिती (Business Details)',
    businessNameLabel: 'व्यवसाय / दुकानाचे नाव',
    businessNamePlaceholder: 'उदा. रॉयल वाईन शॉप',
    addressLabel: 'दुकानाचा पत्ता',
    addressPlaceholder: 'संपूर्ण दुकान पत्ता, शहर, जिल्हा',
    ownerMobileLabel: 'मालकाचा मोबाईल नंबर',
    ownerMobilePlaceholder: '10 अंकी मोबाईल नंबर',
    vatLabel: 'व्हॅट (State VAT / TIN) नंबर (ऐच्छिक)',
    vatPlaceholder: '27001234567V',
    licenceLabel: 'परवाना / नोंदणी संदर्भ (FL-II / CL-III)',
    licencePlaceholder: 'उदा. FL-II/PUN/2026/045',
    credentialsSection: 'लॉगिन माहिती (Login Credentials)',
    loginMobileLabel: 'लॉगिन मोबाईल नंबर',
    loginMobilePlaceholder: '10 अंकी मोबाईल नंबर',
    passwordLabel: 'पासवर्ड',
    passwordPlaceholder: 'किमान 8 अक्षरे',
    confirmPasswordLabel: 'पासवर्ड पुष्टीकरण (Confirm)',
    confirmPasswordPlaceholder: 'पासवर्ड पुन्हा टाका',
    languageSelectLabel: 'प्राधान्य भाषा (Language)',
    completeSetupButton: 'व्यवसाय सेटअप पूर्ण करा',
    settingUp: 'सेटअप होत आहे...',

    // Login
    loginHeading: 'LiquorFlow मध्ये लॉगिन करा',
    loginSubheading: 'तुमच्या दुकानाचा डॅशबोर्ड व्यवस्थापित करा',
    loginButton: 'Login',
    loggingIn: 'लॉगिन होत आहे...',
    invalidCredentialsAlert: 'Invalid username or password',
    setupRequiredNotice: 'सेटअप अजून पूर्ण झालेला नाही.',
    goToSetup: 'सेटअप पृष्ठावर जा',

    // Dashboard
    todaysSales: 'आजची विक्री (Today’s Sales)',
    todaysPurchases: 'आजची खरेदी (Today’s Purchases)',
    currentStock: 'एकूण उपलब्ध स्टॉक (Units)',
    stockValuation: 'स्टॉक एकूण मूल्यांकन (Valuation)',
    totalProducts: 'एकूण उत्पादने',
    lowStockAlert: 'कमी स्टॉक अलर्ट (Low Stock)',
    categoryWiseStock: 'विभागनिहाय स्टॉक (Category-wise)',
    salesSummary: 'विक्री सारांश',
    purchaseSummary: 'खरेदी सारांश',
    recentTransactions: 'अलीकडील व्यवहार (Recent Transactions)',
    quickActions: 'त्वरित कृती (Quick Actions)',
    newSale: 'नवीन विक्री (Sale POS)',
    newPurchase: 'खरेदी आवक (Purchase)',
    addOpeningStock: 'ओपनिंग स्टॉक नोंदणी',
    units: 'नग',
    rupeesSymbol: '₹',

    // Config Error
    configErrorHeading: 'डेटाबेस कॉन्फिगरेशन आवश्यक आहे',
    configErrorSubheading: 'LiquorFlow ला थेट Supabase PostgreSQL क्रेडेंशियल्स आवश्यक आहेत.',
    missingVariablesNotice: 'खालील पर्यावरण व्हेरिएबल्स .env मध्ये उपलब्ध नाहीत:',
    recheckConnection: 'कनेक्शन पुन्हा तपासा',
    viewMigrationGuide: 'मायग्रेशन SQL तपासा',

    // Masters Management
    productsTitle: 'उत्पादने (Product Master)',
    addProduct: 'नवीन उत्पादन जोडा',
    editProduct: 'उत्पादन संपादित करा',
    deleteProduct: 'उत्पादन हटवा',
    productName: 'उत्पादनाचे नाव',
    category: 'वर्गवारी (Category)',
    brand: 'ब्रँड (Brand)',
    packSize: 'पॅक साईज (Pack Size)',
    packType: 'पॅक प्रकार (Bottle/Can)',
    sku: 'SKU / बारकोड',
    purchasePrice: 'खरेदी किंमत (TP/Purchase ₹)',
    sellingPrice: 'विक्री किंमत (Selling ₹)',
    mrp: 'कमाल किरकोळ किंमत (MRP ₹)',
    status: 'स्थिती (Status)',
    complianceRef: 'उत्पादन शुल्क संदर्भ (Excise Ref)',
    openingStock: 'सुरुवातीचा स्टॉक (Opening Stock)',
    actions: 'कृती',
    searchProducts: 'नाव किंवा SKU ने उत्पादन शोधा...',
    allCategories: 'सर्व वर्गवारी',
    allBrands: 'सर्व ब्रँड्स',
    allStatus: 'सर्व स्थिती',

    brandsTitle: 'ब्रँड्स (Brand Master)',
    addBrand: 'नवीन ब्रँड जोडा',
    editBrand: 'ब्रँड संपादित करा',
    brandName: 'ब्रँडचे नाव',
    maharashtraStatus: 'महाराष्ट्र नोंदणी स्थिती',
    regReference: 'नोंदणी संदर्भ (Registration Ref)',
    searchBrands: 'ब्रँडचे नाव किंवा संदर्भाने शोधा...',

    packSizesTitle: 'पॅक साईज (Pack Size Master)',
    addPackSize: 'नवीन पॅक साईज जोडा',
    editPackSize: 'पॅक साईज संपादित करा',
    packSizeName: 'पॅकचे नाव',
    volumeMl: 'प्रमाण (मिली/Volume ml)',
    searchPackSizes: 'पॅक साईज शोधा...',

    // Pagination & Common Actions
    showing: 'दर्शवित आहे',
    of: 'पैकी',
    previous: 'मागील',
    next: 'पुढील',
    activate: 'सक्रिय करा',
    deactivate: 'निष्क्रिय करा',
    confirmDeactivateTitle: 'उत्पादन निष्क्रिय करायचे का?',
    confirmDeactivateMsg: 'हे उत्पादन निष्क्रिय केल्यास नवीन विक्री बिलांमध्ये दिसणार नाही. परंतु जुना लेखा इतिहास सुरक्षित राहील.',
    confirmDeleteTitle: 'उत्पादन कायमचे हटवायचे का?',
    confirmDeleteMsg: 'हे उत्पादन कायमचे हटवले जाईल. जर या उत्पादनाचा कोणताही व्यवहार असेल तर ते हटवता येणार नाही.',

    // Common
    save: 'जतन करा',
    cancel: 'रद्द करा',
    close: 'बंद करा',
    loading: 'लोड होत आहे...',
    success: 'यशस्वी!',
    error: 'त्रुटी',
    active: 'सक्रिय',
    inactive: 'निष्क्रिय',
    noDataFound: 'कोणताही डेटा आढळला नाही',
  },

  hi: {
    appName: 'लिकरफ्लो',
    appTagline: 'शराब दुकान एवं बार इन्वेंट्री एवं ईआरपी प्रणाली',

    // Navigation
    navDashboard: 'डैशबोर्ड',
    navInventory: 'इन्वेंट्री',
    navProducts: 'उत्पाद (Products)',
    navBrands: 'ब्रांड्स (Brands)',
    navPackSizes: 'पैक साइज (Pack Sizes)',
    navPurchases: 'खरीद (Inward)',
    navSales: 'बिक्री (POS)',
    navReports: 'रिपोर्ट्स',
    navSettings: 'सेटिंग्स',
    navLogout: 'लॉग आउट',
    searchPlaceholder: 'उत्पाद, ब्रांड, SKU या बिल खोजें... (Ctrl+K)',
    globalSearchHint: 'खोजने के लिए Ctrl + K दबाएं',

    // Setup
    setupHeading: 'Welcome to LiquorFlow',
    setupSubheading: "Let's set up your business before you start.",
    businessInfoSection: 'व्यापार जानकारी (Business Details)',
    businessNameLabel: 'दुकान / व्यवसाय का नाम',
    businessNamePlaceholder: 'उदा. रॉयल वाइन शॉप',
    addressLabel: 'दुकान का पता',
    addressPlaceholder: 'पूरा दुकान पता, शहर, जिला',
    ownerMobileLabel: 'मालिक का मोबाइल नंबर',
    ownerMobilePlaceholder: '10 अंकों का मोबाइल नंबर',
    vatLabel: 'वैट (State VAT / TIN) नंबर (वैकल्पिक)',
    vatPlaceholder: '27001234567V',
    licenceLabel: 'लाइसेंस / पंजीकरण संदर्भ (FL-II / CL-III)',
    licencePlaceholder: 'उदा. FL-II/PUN/2026/045',
    credentialsSection: 'लॉगिन क्रेडेंशियल (Login Credentials)',
    loginMobileLabel: 'लॉगिन मोबाइल नंबर',
    loginMobilePlaceholder: '10 अंकों का मोबाइल नंबर',
    passwordLabel: 'पासवर्ड',
    passwordPlaceholder: 'न्यूनतम 8 अक्षर',
    confirmPasswordLabel: 'पासवर्ड पुष्टि (Confirm Password)',
    confirmPasswordPlaceholder: 'पासवर्ड पुनः दर्ज करें',
    languageSelectLabel: 'पसंदीदा भाषा (Language)',
    completeSetupButton: 'व्यवसाय सेटअप पूरा करें',
    settingUp: 'सेटअप हो रहा है...',

    // Login
    loginHeading: 'LiquorFlow में लॉगिन करें',
    loginSubheading: 'अपनी दुकान का प्रबंधन करें',
    loginButton: 'Login',
    loggingIn: 'लॉगिन हो रहा है...',
    invalidCredentialsAlert: 'Invalid username or password',
    setupRequiredNotice: 'सेटअप अभी पूरा नहीं हुआ है।',
    goToSetup: 'सेटअप पर जाएं',

    // Dashboard
    todaysSales: 'आज की बिक्री (Today’s Sales)',
    todaysPurchases: 'आज की खरीद (Today’s Purchases)',
    currentStock: 'कुल उपलब्ध स्टॉक (Units)',
    stockValuation: 'स्टॉक कुल मूल्यांकन (Valuation)',
    totalProducts: 'कुल उत्पाद',
    lowStockAlert: 'कम स्टॉक चेतावनी (Low Stock)',
    categoryWiseStock: 'श्रेणीवार स्टॉक (Category-wise)',
    salesSummary: 'बिक्री सारांश',
    purchaseSummary: 'खरीद सारांश',
    recentTransactions: 'हाल के लेन-देन (Recent Transactions)',
    quickActions: 'त्वरित कार्य (Quick Actions)',
    newSale: 'नई बिक्री (Sale POS)',
    newPurchase: 'खरीद आवक (Purchase)',
    addOpeningStock: 'आरंभिक स्टॉक दर्ज करें',
    units: 'नग',
    rupeesSymbol: '₹',

    // Config Error
    configErrorHeading: 'डेटाबेस कॉन्फ़िगरेशन आवश्यक है',
    configErrorSubheading: 'LiquorFlow को सीधे Supabase PostgreSQL क्रेडेंशियल्स की आवश्यकता है।',
    missingVariablesNotice: 'निम्नलिखित पर्यावरण चर .env में गायब हैं:',
    recheckConnection: 'कनेक्शन पुनः जांचें',
    viewMigrationGuide: 'माइग्रेशन SQL देखें',

    // Masters Management
    productsTitle: 'उत्पाद (Product Master)',
    addProduct: 'नया उत्पाद जोड़ें',
    editProduct: 'उत्पाद संपादित करें',
    deleteProduct: 'उत्पाद हटाएं',
    productName: 'उत्पाद का नाम',
    category: 'श्रेणी (Category)',
    brand: 'ब्रांड (Brand)',
    packSize: 'पैक साइज (Pack Size)',
    packType: 'पैक प्रकार (Bottle/Can)',
    sku: 'SKU / बारकोड',
    purchasePrice: 'खरीद मूल्य (TP/Purchase ₹)',
    sellingPrice: 'बिक्री मूल्य (Selling ₹)',
    mrp: 'अधिकतम खुदरा मूल्य (MRP ₹)',
    status: 'स्थिति (Status)',
    complianceRef: 'आबकारी संदर्भ (Excise Ref)',
    openingStock: 'आरंभिक स्टॉक (Opening Stock)',
    actions: 'क्रियाएं',
    searchProducts: 'नाम या SKU से उत्पाद खोजें...',
    allCategories: 'सभी श्रेणियां',
    allBrands: 'सभी ब्रांड्स',
    allStatus: 'सभी स्थिति',

    brandsTitle: 'ब्रांड्स (Brand Master)',
    addBrand: 'नया ब्रांड जोड़ें',
    editBrand: 'ब्रांड संपादित करें',
    brandName: 'ब्रांड का नाम',
    maharashtraStatus: 'महाराष्ट्र पंजीकरण स्थिति',
    regReference: 'पंजीकरण संदर्भ (Registration Ref)',
    searchBrands: 'ब्रांड नाम या संदर्भ से खोजें...',

    packSizesTitle: 'पैक साइज (Pack Size Master)',
    addPackSize: 'नया पैक साइज जोड़ें',
    editPackSize: 'पैक साइज संपादित करें',
    packSizeName: 'पैक का नाम',
    volumeMl: 'मात्रा (मिली/Volume ml)',
    searchPackSizes: 'पैक साइज खोजें...',

    // Pagination & Common Actions
    showing: 'दिखा रहे हैं',
    of: 'में से',
    previous: 'पिछला',
    next: 'अगला',
    activate: 'सक्रिय करें',
    deactivate: 'निष्क्रिय करें',
    confirmDeactivateTitle: 'क्या आप उत्पाद को निष्क्रिय करना चाहते हैं?',
    confirmDeactivateMsg: 'उत्पाद को निष्क्रिय करने पर यह नई बिक्री बिलिंग में नहीं दिखेगा, लेकिन पिछला डेटा सुरक्षित रहेगा।',
    confirmDeleteTitle: 'क्या आप उत्पाद को हटाना चाहते हैं?',
    confirmDeleteMsg: 'यदि इस उत्पाद से जुड़ा कोई लेन-देन है, तो इसे हटाया नहीं जा सकेगा।',

    // Common
    save: 'सहेजें',
    cancel: 'रद्द करें',
    close: 'बंद करें',
    loading: 'लोड हो रहा है...',
    success: 'सफल!',
    error: 'त्रुटि',
    active: 'सक्रिय',
    inactive: 'निष्क्रिय',
    noDataFound: 'कोई डेटा नहीं मिला',
  },

  en: {
    appName: 'LiquorFlow',
    appTagline: 'Liquor Shop & Bar Inventory & ERP System',

    // Navigation
    navDashboard: 'Dashboard',
    navInventory: 'Inventory',
    navProducts: 'Products',
    navBrands: 'Brands',
    navPackSizes: 'Pack Sizes',
    navPurchases: 'Purchases (Inward)',
    navSales: 'Sales (POS)',
    navReports: 'Reports',
    navSettings: 'Settings',
    navLogout: 'Logout',
    searchPlaceholder: 'Search products, brands, SKU, invoices... (Ctrl+K)',
    globalSearchHint: 'Press Ctrl + K or / to search',

    // Setup
    setupHeading: 'Welcome to LiquorFlow',
    setupSubheading: "Let's set up your business before you start.",
    businessInfoSection: 'Business Information',
    businessNameLabel: 'Business / Shop Name',
    businessNamePlaceholder: 'e.g., Royal Wine & Spirits',
    addressLabel: 'Business Address',
    addressPlaceholder: 'Complete shop address, city, district',
    ownerMobileLabel: 'Owner Mobile Number',
    ownerMobilePlaceholder: '10-digit mobile number',
    vatLabel: 'State VAT / TIN Number (Optional)',
    vatPlaceholder: '27001234567V',
    licenceLabel: 'Licence / Registration Reference (FL-II / CL-III)',
    licencePlaceholder: 'e.g. FL-II/2026/089',
    credentialsSection: 'Login Credentials',
    loginMobileLabel: 'Mobile Number',
    loginMobilePlaceholder: '10-digit mobile number',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Minimum 8 characters',
    confirmPasswordLabel: 'Confirm Password',
    confirmPasswordPlaceholder: 'Re-enter your password',
    languageSelectLabel: 'Preferred Language',
    completeSetupButton: 'Complete Setup & Launch',
    settingUp: 'Configuring your business...',

    // Login
    loginHeading: 'Login to LiquorFlow',
    loginSubheading: 'Manage daily shop inventory, POS & excise records',
    loginButton: 'Login',
    loggingIn: 'Authenticating...',
    invalidCredentialsAlert: 'Invalid username or password',
    setupRequiredNotice: 'Application setup is not completed yet.',
    goToSetup: 'Go to Setup',

    // Dashboard
    todaysSales: "Today's Sales",
    todaysPurchases: "Today's Purchases",
    currentStock: 'Current Stock (Units)',
    stockValuation: 'Stock Valuation',
    totalProducts: 'Total Products',
    lowStockAlert: 'Low Stock Alert',
    categoryWiseStock: 'Category-wise Stock',
    salesSummary: 'Sales Summary',
    purchaseSummary: 'Purchase Summary',
    recentTransactions: 'Recent Stock Ledger Transactions',
    quickActions: 'Quick Operations',
    newSale: 'New POS Sale',
    newPurchase: 'New Inward Purchase',
    addOpeningStock: 'Opening / TP Stock',
    units: 'Units',
    rupeesSymbol: '₹',

    // Config Error
    configErrorHeading: 'Database Configuration Required',
    configErrorSubheading: 'LiquorFlow requires production Supabase PostgreSQL credentials to initialize.',
    missingVariablesNotice: 'The following required environment variables are missing or unconfigured in .env:',
    recheckConnection: 'Test Connection',
    viewMigrationGuide: 'View Database Schema / Migration',

    // Masters Management
    productsTitle: 'Product Master',
    addProduct: 'Add New Product',
    editProduct: 'Edit Product',
    deleteProduct: 'Delete Product',
    productName: 'Product Name',
    category: 'Category',
    brand: 'Brand',
    packSize: 'Pack Size',
    packType: 'Pack Type',
    sku: 'SKU / Barcode',
    purchasePrice: 'Purchase Price (TP ₹)',
    sellingPrice: 'Selling Price (₹)',
    mrp: 'Maximum Retail Price (MRP ₹)',
    status: 'Status',
    complianceRef: 'Excise / Compliance Ref',
    openingStock: 'Opening Stock (Bottles)',
    actions: 'Actions',
    searchProducts: 'Search products by name or SKU...',
    allCategories: 'All Categories',
    allBrands: 'All Brands',
    allStatus: 'All Statuses',

    brandsTitle: 'Brand Master',
    addBrand: 'Add New Brand',
    editBrand: 'Edit Brand',
    brandName: 'Brand Name',
    maharashtraStatus: 'State Registration Status',
    regReference: 'Registration Reference',
    searchBrands: 'Search brands by name or reference...',

    packSizesTitle: 'Pack Size Master',
    addPackSize: 'Add Pack Size',
    editPackSize: 'Edit Pack Size',
    packSizeName: 'Pack Size Name',
    volumeMl: 'Volume (ml)',
    searchPackSizes: 'Search pack sizes...',

    // Pagination & Common Actions
    showing: 'Showing',
    of: 'of',
    previous: 'Previous',
    next: 'Next',
    activate: 'Activate',
    deactivate: 'Deactivate',
    confirmDeactivateTitle: 'Deactivate Product?',
    confirmDeactivateMsg: 'Deactivating this product hides it from new POS sales billing, while preserving all historical stock and tax ledgers.',
    confirmDeleteTitle: 'Permanently Delete Product?',
    confirmDeleteMsg: 'This product will be permanently deleted. If any transactions or stock movements exist, deletion will be rejected.',

    // Common
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    loading: 'Loading...',
    success: 'Success!',
    error: 'Error',
    active: 'Active',
    inactive: 'Inactive',
    noDataFound: 'No records found',
  },
};
