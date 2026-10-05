import React, { useState, useEffect } from 'react';
import { ArrowRight, ChevronRight, BarChart3, ShieldCheck, Menu, X, Award, Percent, Layers, Landmark } from 'lucide-react';
import { AboutUs } from './AboutUs';
import { ContactUs } from './ContactUs';
import { LiquorFlowLogo } from '../common/LiquorFlowLogo';

interface LandingPageProps {
  onGoToLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGoToLogin }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="bg-slate-950 min-h-screen font-sans">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-slate-950/90 backdrop-blur-md border-b border-slate-900 py-3' : 'bg-transparent py-6'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <LiquorFlowLogo size="sm" variant="full" theme="white" />
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#" className="text-slate-300 hover:text-white text-sm font-medium transition-colors">Home</a>
              <a href="#about" className="text-slate-300 hover:text-white text-sm font-medium transition-colors">About</a>
              <a href="#contact" className="text-slate-300 hover:text-white text-sm font-medium transition-colors">Contact Support</a>
              <button 
                onClick={onGoToLogin}
                className="px-5 py-2 bg-[#FF6B00] text-slate-950 text-sm font-extrabold rounded-xl hover:bg-[#ff8c33] transition-all"
              >
                Sign In
              </button>
            </div>

            <button 
              className="md:hidden text-slate-300"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-slate-950 border-b border-slate-900 p-4 space-y-4">
            <a href="#" className="block text-slate-300 hover:text-white text-base font-medium py-2" onClick={() => setIsMenuOpen(false)}>Home</a>
            <a href="#about" className="block text-slate-300 hover:text-white text-base font-medium py-2" onClick={() => setIsMenuOpen(false)}>About</a>
            <a href="#contact" className="block text-slate-300 hover:text-white text-base font-medium py-2" onClick={() => setIsMenuOpen(false)}>Contact Support</a>
            <button 
              onClick={() => { onGoToLogin(); setIsMenuOpen(false); }}
              className="w-full px-5 py-3 bg-[#FF6B00] text-slate-950 font-extrabold rounded-xl hover:bg-[#ff8c33] transition-all"
            >
              Sign In to ERP
            </button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <header className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#FF6B0022,transparent_60%)]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-[#FF6B00] text-xs font-bold uppercase tracking-widest mb-6">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Maharashtra State Excise Compliance Ready</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight mb-8">
              LiquorFlow ERP <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">
                Premium Bar & Excise Operating System
              </span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg text-slate-400 mb-10 leading-relaxed">
              The trusted ERP software for professional bars, restaurants, and liquor retail operations. 
              Unify live inventory tracking, Transport Permit (TP) imports, instant FLR-3/CL-3 register generation, and tax compliance.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={onGoToLogin}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-extrabold rounded-2xl hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10 cursor-pointer"
              >
                Access System Console
                <ArrowRight className="w-5 h-5" />
              </button>
              <a 
                href="#contact"
                className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white font-bold rounded-2xl border border-slate-800 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                Contact Support
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Quick Stats */}
      <section className="py-12 border-y border-slate-900 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-1">100%</div>
              <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Excise Compliant</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-1">Live</div>
              <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Stock Ledgering</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-1">Instant</div>
              <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">FLR-3 / CL-3 Forms</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-1">Zero</div>
              <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Permit Discrepancies</div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-24 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800/50 hover:border-orange-500/30 transition-all group">
              <div className="w-14 h-14 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Layers className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Precision Inventory</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Track products from master brand configuration down to exact variant milliliter volumes and bottle/peg count adjustments.
              </p>
            </div>
            <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800/50 hover:border-orange-500/30 transition-all group">
              <div className="w-14 h-14 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Landmark className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Excise Verification</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Log Transport Permits (TP) with pass numbers, dates of pass, and batch codes to seamlessly auto-generate error-free state registers.
              </p>
            </div>
            <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800/50 hover:border-orange-500/30 transition-all group">
              <div className="w-14 h-14 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Daily Sales Reporting</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Capture exact daily POS sales counters, closing stock physical reconciliations, and generate precise operational profit ledgers.
              </p>
            </div>
          </div>
        </div>
      </section>

      <AboutUs />
      <ContactUs />

      <footer className="py-12 bg-slate-950 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500 text-sm">
          <p>© {new Date().getFullYear()} LiquorFlow ERP. All rights reserved.</p>
          <p className="mt-2">Enterprise-Grade Bar, Restaurant & Excise Inventory Management Suite</p>
        </div>
      </footer>
    </div>
  );
};
