import React, { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Layers,
  FileInput,
  ArrowDownToLine,
  SlidersHorizontal,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { SupportedLanguage } from '../../types';
import { LiquorFlowLogo } from './LiquorFlowLogo';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  language: SupportedLanguage;
  onNavigateTo?: (route: string) => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  language,
  onNavigateTo,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const contentByLang = {
    en: [
      {
        title: 'Welcome to LiquorFlow ERP',
        subtitle: 'Complete Inventory & Excise Compliance System',
        icon: Sparkles,
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        route: '/dashboard',
        description:
          'LiquorFlow is purpose-built for Bar, Restaurant, and Liquor retail operations in Maharashtra. Manage stock batches, transport permits (TP), excise registers, and audits with 100% precision.',
        highlights: [
          'Unified Real-Time Stock Ledger',
          'Automated Excise Forms & Registers',
          'Batch & Transport Permit (TP) Tracking',
          'Single-User Secure Session Management',
        ],
      },
      {
        title: 'Dashboard & Real-Time KPIs',
        subtitle: 'Instant visibility into your stock health',
        icon: LayoutDashboard,
        color: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
        route: '/dashboard',
        description:
          'Monitor your total stock valuation, category distribution (IMFL, Country Liquor, Beer, Wine), low-stock alerts, and recent inventory movements in one centralized command center.',
        highlights: [
          'Live valuation across all stockrooms',
          'Instant warnings for depleted SKUs',
          'Quick action buttons for daily routines',
        ],
      },
      {
        title: 'Product & Masters Configuration',
        subtitle: 'Standardize brands, manufacturers, and pack sizes',
        icon: Layers,
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        route: '/products',
        description:
          'Set up your product catalog by linking manufacturers, brand names, and standardized Maharashtra pack sizes (750ml, 375ml, 180ml, 650ml, 500ml, 330ml).',
        highlights: [
          'Pre-configured Maharashtra liquor categories',
          'Standard pack type volume mappings',
          'Brand excise registration reference tracking',
        ],
      },
      {
        title: 'Opening Stock & TP Inwards',
        subtitle: 'Record initial balance with Transport Permits',
        icon: FileInput,
        color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
        route: '/stock/opening',
        description:
          'Establish your starting inventory baseline or record TP (Transport Permit) batches. Record opening bottles, bulk litres, and verified purchase rates for exact ledger accounting.',
        highlights: [
          'TP pass number and verification date',
          'Batch number & manufacturing year',
          'Automatic stock ledger initialization',
        ],
      },
      {
        title: 'Purchases & Stock Inward',
        subtitle: 'Log fresh consignments and supplier invoices',
        icon: ArrowDownToLine,
        color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
        route: '/purchases',
        description:
          'Log incoming distillery or wholesale consignments with supplier invoice details, transport pass numbers, bottle quantities, and excise duty breakdowns.',
        highlights: [
          'Immediate stock quantity increment',
          'Weighted average purchase cost update',
          'Digital archival of pass & bill numbers',
        ],
      },
      {
        title: 'Stock Adjustments & Breakages',
        subtitle: 'Handle audit variances, spills, and transit breakage',
        icon: SlidersHorizontal,
        color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
        route: '/stock/adjustments',
        description:
          'Reconcile physical inventory with system books. Record approved breakage, spoiled stock, or physical audit adjustments with audit reasons for excise inspectors.',
        highlights: [
          'Detailed justification notes for audits',
          'Automatic balance recalculation',
          'Separate audit trail for inspections',
        ],
      },
      {
        title: 'Excise Registers & Inspection Reports',
        subtitle: 'Audit-ready compliance reporting at your fingertips',
        icon: ShieldCheck,
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        route: '/excise',
        description:
          'Generate daily and monthly excise inspection registers (FLR-3 / CL-3 formats) compliant with Maharashtra state excise guidelines. Export ready-to-print reports anytime.',
        highlights: [
          'FLR-3 / CL-3 register generation',
          'Daily opening, inward, consumption & closing balances',
          'PDF / Excel export for licensing inspections',
        ],
      },
    ],
    hi: [
      {
        title: 'LiquorFlow ERP में आपका स्वागत है',
        subtitle: 'संपूर्ण इन्वेंटरी एवं आबकारी (Excise) प्रबंधन प्रणाली',
        icon: Sparkles,
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        route: '/dashboard',
        description:
          'LiquorFlow महाराष्ट्र के बार, रेस्टोरेंट और शराब खुदरा दुकानों के लिए विशेष रूप से डिज़ाइन किया गया है। स्टॉक बैच, ट्रांसपोर्ट परमिट (TP) और आबकारी रजिस्टरों का 100% सटीक प्रबंधन करें।',
        highlights: [
          'रीयल-टाइम स्टॉक लेजर',
          'स्वचालित आबकारी फॉर्म और रजिस्टर',
          'बैच और ट्रांसपोर्ट परमिट (TP) ट्रैकिंग',
          'सुरक्षित सिंगल-यूजर सत्र',
        ],
      },
      {
        title: 'डैशबोर्ड एवं मुख्य मेट्रिक्स',
        subtitle: 'स्टॉक की स्थिति की त्वरित जानकारी',
        icon: LayoutDashboard,
        color: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
        route: '/dashboard',
        description:
          'कुल स्टॉक मूल्यांकन, श्रेणी वितरण (IMFL, देसी दारू, बीयर, वाइन) और कम स्टॉक की चेतावनी एक ही स्क्रीन पर देखें।',
        highlights: [
          'सभी स्टॉक का लाइव मूल्यांकन',
          'कम स्टॉक की तुरंत चेतावनी',
          'दैनिक कार्यों के लिए त्वरित बटन',
        ],
      },
      {
        title: 'उत्पाद एवं मास्टर्स कॉन्फ़िगरेशन',
        subtitle: 'ब्रांड, निर्माता और पैक साइज़ व्यवस्थित करें',
        icon: Layers,
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        route: '/products',
        description:
          'निर्माताओं, ब्रांडों और महाराष्ट्र के मानक पैक आकारों (750ml, 375ml, 180ml, 650ml) को लिंक करके अपनी उत्पाद सूची बनाएं।',
        highlights: [
          'मानक आबकारी श्रेणियां',
          'पैक आकार और वॉल्यूम मैपिंग',
          'ब्रांड पंजीकरण संदर्भ',
        ],
      },
      {
        title: 'प्रारंभिक स्टॉक एवं TP इनवर्ड',
        subtitle: 'परमिट के साथ प्रारंभिक स्टॉक दर्ज करें',
        icon: FileInput,
        color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
        route: '/stock/opening',
        description:
          'अपनी दुकान का शुरुआती स्टॉक या ट्रांसपोर्ट परमिट (TP) बैच दर्ज करें। बोतल संख्या, बैच नंबर और खरीद दर सुरक्षित करें।',
        highlights: [
          'TP पास नंबर और सत्यापन तारीख',
          'बैच नंबर और निर्माण वर्ष',
          'स्वचालित लेजर एंट्री',
        ],
      },
      {
        title: 'खरीद एवं स्टॉक आवक (Inward)',
        subtitle: 'नए माल और सप्लायर बिलों को दर्ज करें',
        icon: ArrowDownToLine,
        color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
        route: '/purchases',
        description:
          'सप्लायर इनवॉइस, पास नंबर, बोतल संख्या और आबकारी शुल्क के साथ आने वाले माल की प्रविष्टि करें।',
        highlights: [
          'तुरंत स्टॉक बढ़ोतरी',
          'औसत खरीद लागत की गणना',
          'बिल और पास नंबर का डिजिटल रिकॉर्ड',
        ],
      },
      {
        title: 'स्टॉक समायोजन एवं टूट-फूट',
        subtitle: 'भौतिक ऑडिट और ब्रेकेज का प्रबंधन',
        icon: SlidersHorizontal,
        color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
        route: '/stock/adjustments',
        description:
          'भौतिक स्टॉक और सिस्टम स्टॉक का मिलान करें। स्वीकृत टूट-फूट या नुकसान को स्पष्ट कारणों के साथ दर्ज करें।',
        highlights: [
          'ऑडिट के लिए स्पष्ट विवरण',
          'स्वचालित बैलेंस सुधार',
          'आबकारी निरीक्षण के लिए अलग लॉग',
        ],
      },
      {
        title: 'आबकारी रजिस्टर एवं रिपोर्ट',
        subtitle: 'निरीक्षण के लिए तैयार वैधानिक रिपोर्ट',
        icon: ShieldCheck,
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        route: '/excise',
        description:
          'महाराष्ट्र आबकारी नियमों के अनुसार दैनिक एवं मासिक FLR-3 / CL-3 रजिस्टर तुरंत तैयार और डाउनलोड करें।',
        highlights: [
          'FLR-3 / CL-3 रजिस्टर तैयार करना',
          'दैनिक ओपनिंग, इनवर्ड, बिक्री और क्लोजिंग',
          'प्रिंट और निर्यात के लिए तैयार',
        ],
      },
    ],
    mr: [
      {
        title: 'LiquorFlow ERP मध्ये आपले स्वागत आहे',
        subtitle: 'संपूर्ण इन्व्हेंटरी आणि राज्य उत्पादन शुल्क (Excise) व्यवस्थापन',
        icon: Sparkles,
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        route: '/dashboard',
        description:
          'महाराष्ट्र राज्य उत्पादन शुल्क नियमांनुसार बार, रेस्टॉरंट आणि दारू विक्रीसाठी विशेष तयार केलेले ERP सॉफ्टवेअर. स्टॉक बॅच, ट्रान्सपोर्ट परमिट (TP) आणि रजिस्टर १००% अचूक व्यवस्थापित करा.',
        highlights: [
          'रिअल-टाइम स्टॉक लेजर',
          'स्वयंचलित एक्साईज फॉर्म्स आणि रजिस्टर्स',
          'बॅच आणि TP पास ट्रॅकिंग',
          'सुरक्षित सिंगल-युझर सत्र',
        ],
      },
      {
        title: 'डॅशबोर्ड आणि थेट आकडेवारी',
        subtitle: 'स्टॉकच्या स्थितीची झटपट माहिती',
        icon: LayoutDashboard,
        color: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
        route: '/dashboard',
        description:
          'एकूण स्टॉकचे मूल्यांकन, श्रेणीनुसार विभागणी (IMFL, देशी दारू, बीअर, वाइन) आणि कमी स्टॉकचे इशारे एकाच डॅशबोर्डवर पहा.',
        highlights: [
          'थेट स्टॉक मूल्यांकन',
          'कमी स्टॉकचे त्वरित अलर्ट्स',
          'दैनंदिन कामांसाठी जलद बटणे',
        ],
      },
      {
        title: 'उत्पादने व मास्टर्स कॉन्फिगरेशन',
        subtitle: 'ब्रँड, उत्पादक आणि बाटली आकार व्यवस्थापन',
        icon: Layers,
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        route: '/products',
        description:
          'उत्पादक, ब्रँड्स आणि महाराष्ट्र प्रमाणभूत पॅक आकार (750ml, 375ml, 180ml, 650ml) जोडून आपली उत्पादन यादी तयार करा.',
        highlights: [
          'अधिकृत एक्साईज वर्गवारी',
          'पॅक आकार व मिली मॅपिंग',
          'ब्रँड नोंदणी संदर्भ',
        ],
      },
      {
        title: 'प्रारंभिक स्टॉक व TP इनवर्ड',
        subtitle: 'परमिटनुसार सुरुवातीचा स्टॉक नोंदवा',
        icon: FileInput,
        color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
        route: '/stock/opening',
        description:
          'आपल्या दुकानाचा सुरुवातीचा साठा किंवा ट्रान्सपोर्ट परमिट (TP) बॅच नोंदवा. बाटल्यांची संख्या, बॅच नंबर आणि खरेदी दर नोंदवा.',
        highlights: [
          'TP पास क्रमांक आणि तारीख',
          'बॅच नंबर आणि उत्पादन वर्ष',
          'लेजरमध्ये स्वयंचलित नोंदणी',
        ],
      },
      {
        title: 'खरेदी व आवक (Purchases)',
        subtitle: 'नवीन मालाची व बिलांची आवक नोंदवा',
        icon: ArrowDownToLine,
        color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
        route: '/purchases',
        description:
          'सप्लायर इनव्हॉइस, पास नंबर, बाटल्यांची संख्या आणि एक्साईज ड्युटीसह नवीन आवक त्वरित नोंदवा.',
        highlights: [
          'स्टॉकमध्ये त्वरित वाढ',
          'सरासरी खरेदी दराची गणना',
          'बिल आणि पास क्रमांकाचा डिजिटल रेकॉर्ड',
        ],
      },
      {
        title: 'स्टॉक ऍडजस्टमेंट व नुकसान/ब्रेकेज',
        subtitle: 'ऑडिट फरक आणि तुटफूट व्यवस्थापन',
        icon: SlidersHorizontal,
        color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
        route: '/stock/adjustments',
        description:
          'प्रत्यक्ष साठा आणि वहीतील साठ्याचा ताळमेळ घाला. अधिकृत ब्रेकेज किंवा नुकसान नोंदवून एक्साईज कारणांची नोंद ठेवा.',
        highlights: [
          'तपासणीसाठी अचूक शेरे',
          'स्वयंचलित स्टॉक सुधारणा',
          'स्वतंत्र ऑडिट लॉग',
        ],
      },
      {
        title: 'एक्साईज रजिस्टर्स व अहवाल',
        subtitle: 'तपासणीसाठी सज्ज अधिकृत अहवाल',
        icon: ShieldCheck,
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        route: '/excise',
        description:
          'महाराष्ट्र राज्य उत्पादन शुल्क नियमांनुसार FLR-3 / CL-3 दैनिक व मासिक रजिस्टर एका क्लिकवर तयार करा व प्रिंट करा.',
        highlights: [
          'FLR-3 / CL-3 रजिस्टर निर्मिती',
          'दैनंदिन शिल्लक, आवक, विक्री व अखेरची शिल्लक',
          'प्रिंट व निर्यातीसाठी सज्ज',
        ],
      },
    ],
  };

  const steps = contentByLang[language] || contentByLang.en;
  const step = steps[currentStep];
  const StepIcon = step.icon;
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <LiquorFlowLogo size="xs" showSubtitle={false} />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {language === 'mr' ? 'मार्गदर्शक ट्यूटोरिअल' : language === 'hi' ? 'मार्गदर्शिका ट्यूटोरियल' : 'Interactive Walkthrough'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-amber-400">
              {currentStep + 1} / {steps.length}
            </span>
            <button
              onClick={handleSkip}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Tutorial"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6 flex-1">
          {/* Step Icon & Headings */}
          <div className="flex items-start gap-4">
            <div className={`p-3.5 rounded-2xl border shrink-0 ${step.color} shadow-lg`}>
              <StepIcon className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight leading-snug">
                {step.title}
              </h2>
              <p className="text-xs font-medium text-amber-400 mt-0.5">
                {step.subtitle}
              </p>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-slate-300 leading-relaxed">
            {step.description}
          </p>

          {/* Feature Highlights */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {language === 'mr' ? 'प्रमुख वैशिष्ट्ये' : language === 'hi' ? 'मुख्य विशेषताएं' : 'Key Highlights'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {step.highlights.map((h, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 pt-2">
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentStep(i)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  i === currentStep
                    ? 'w-8 bg-amber-500 shadow-md shadow-amber-500/20'
                    : 'w-2 bg-slate-700 hover:bg-slate-600'
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer px-2 py-1"
          >
            {language === 'mr' ? 'वगळा (Skip)' : language === 'hi' ? 'छोड़ें (Skip)' : 'Skip Tutorial'}
          </button>

          <div className="flex items-center gap-2.5">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{language === 'mr' ? 'मागे' : language === 'hi' ? 'पीछे' : 'Back'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-md shadow-amber-500/10 cursor-pointer"
            >
              <span>
                {isLast
                  ? language === 'mr'
                    ? 'सुरु करा (Finish)'
                    : language === 'hi'
                    ? 'शुरू करें (Finish)'
                    : 'Get Started'
                  : language === 'mr'
                  ? 'पुढे'
                  : language === 'hi'
                  ? 'आगे'
                  : 'Next'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
