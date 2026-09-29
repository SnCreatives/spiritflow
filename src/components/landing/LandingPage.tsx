import React, { useState, useEffect } from 'react';
import { ArrowRight, ChevronRight, Building2, Home, BarChart3, ShieldCheck, Menu, X } from 'lucide-react';
import { AboutUs } from './AboutUs';
import { ContactUs } from './ContactUs';
import { Elite24Logo } from '../common/Elite24Logo';

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
            <Elite24Logo size="sm" />
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#" className="text-slate-300 hover:text-white text-sm font-medium transition-colors">Home</a>
              <a href="#about" className="text-slate-300 hover:text-white text-sm font-medium transition-colors">About</a>
              <a href="#contact" className="text-slate-300 hover:text-white text-sm font-medium transition-colors">Contact</a>
              <button 
                onClick={onGoToLogin}
                className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl border border-slate-800 hover:bg-slate-800 transition-all"
              >
                Login
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
            <a href="#contact" className="block text-slate-300 hover:text-white text-base font-medium py-2" onClick={() => setIsMenuOpen(false)}>Contact</a>
            <button 
              onClick={() => { onGoToLogin(); setIsMenuOpen(false); }}
              className="w-full px-5 py-3 bg-slate-900 text-white font-bold rounded-xl border border-slate-800 hover:bg-slate-800 transition-all"
            >
              Staff Login
            </button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <header className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#fbbf2433,transparent_60%)]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-widest mb-6">
              <Building2 className="w-3.5 h-3.5" />
              <span>Pune's Trusted Real Estate Partner</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight mb-8">
              Elite24 Property <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                Consulting Company
              </span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg text-slate-400 mb-10 leading-relaxed">
              Specializing in premium residential and commercial properties across Pune. 
              Discover luxury apartments, office spaces, and investment opportunities with expert guidance.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a 
                href="#contact"
                className="w-full sm:w-auto px-8 py-4 bg-amber-500 text-slate-950 font-extrabold rounded-2xl hover:bg-amber-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
              >
                Get a Consultation
                <ArrowRight className="w-5 h-5" />
              </a>
              <button 
                onClick={onGoToLogin}
                className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white font-bold rounded-2xl border border-slate-800 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                Staff Login
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Quick Stats/Features */}
      <section className="py-12 border-y border-slate-900 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-1">15+</div>
              <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Locations</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-1">Premium</div>
              <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">2/3/4 BHK</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-1">Expert</div>
              <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Consulting</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-1">End-to-End</div>
              <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Solutions</div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-24 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800/50 hover:border-amber-500/30 transition-all group">
              <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Home className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Residential</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Luxury apartments, ready-to-move homes, and new residential projects in Baner, Balewadi, and Punawale.
              </p>
            </div>
            <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800/50 hover:border-amber-500/30 transition-all group">
              <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Building2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Commercial</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Premium office spaces, retail shops, and commercial projects in Kothrud, Ravet, and Hinjewadi.
              </p>
            </div>
            <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800/50 hover:border-amber-500/30 transition-all group">
              <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Investment</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Carefully selected real estate options in high-growth areas of Pune for maximum ROI.
              </p>
            </div>
          </div>
        </div>
      </section>

      <AboutUs />
      <ContactUs />

      <footer className="py-12 bg-slate-950 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500 text-sm">
          <p>© {new Date().getFullYear()} Elite24 Property Consulting Company. All rights reserved.</p>
          <p className="mt-2">U-7 Runwal Platinum, Bavdhan, Pune, Maharashtra 411021</p>
        </div>
      </footer>
    </div>
  );
};
