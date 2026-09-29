import React from 'react';
import { Mail, Phone, MapPin, Globe, Instagram, Facebook, Linkedin, Share2 } from 'lucide-react';

export const ContactUs: React.FC = () => {
  return (
    <section id="contact" className="py-20 bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Contact Us</h2>
          <div className="w-20 h-1 bg-amber-500 mx-auto rounded-full"></div>
          <p className="mt-4 text-slate-600">Get in touch with our real estate experts today.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Information */}
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-xl font-bold text-slate-800 mb-6">Contact Information</h3>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Call Us</p>
                    <p className="text-lg font-semibold text-slate-800">088569 47020</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Email Us</p>
                    <p className="text-lg font-semibold text-slate-800">info@elite24.co</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Website</p>
                    <a href="https://elite24.co/" target="_blank" rel="noopener noreferrer" className="text-lg font-semibold text-amber-600 hover:text-amber-700">
                      elite24.co
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Visit Us</p>
                    <p className="text-slate-700">U-7 Runwal Platinum, Bavdhan, Pune, Maharashtra 411021</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-xl font-bold text-slate-800 mb-6">Follow Us</h3>
              <div className="flex flex-wrap gap-4">
                <a href="https://www.instagram.com/elite24pune/" target="_blank" rel="noopener noreferrer" 
                   className="w-12 h-12 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all">
                  <Instagram className="w-6 h-6" />
                </a>
                <a href="https://www.facebook.com/elite24pune/" target="_blank" rel="noopener noreferrer"
                   className="w-12 h-12 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all">
                  <Facebook className="w-6 h-6" />
                </a>
                <a href="https://www.linkedin.com/company/elite24pune/" target="_blank" rel="noopener noreferrer"
                   className="w-12 h-12 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all">
                  <Linkedin className="w-6 h-6" />
                </a>
                <a href="https://in.pinterest.com/elite24_pune/" target="_blank" rel="noopener noreferrer"
                   className="w-12 h-12 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all">
                  <Share2 className="w-6 h-6" />
                </a>
              </div>
            </div>
          </div>

          {/* Map & Form */}
          <div className="space-y-8">
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[300px] md:h-full min-h-[400px]">
              {/* Note: In a real app we'd use an iframe or a map component. For now, a stylized placeholder with link */}
              <div className="relative w-full h-full bg-slate-100 flex flex-col items-center justify-center text-center p-8">
                <MapPin className="w-12 h-12 text-amber-500 mb-4" />
                <h4 className="font-bold text-slate-800 mb-2">Find us on Google Maps</h4>
                <p className="text-slate-600 text-sm mb-6 max-w-xs mx-auto">
                  Click the button below to view our office location in Bavdhan, Pune.
                </p>
                <a 
                  href="https://share.google/dQwrs9eYUgb8cuIoF" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-all shadow-md"
                >
                  Open Maps
                </a>
                <div className="absolute bottom-4 left-4 right-4 text-[10px] text-slate-400">
                  Coordinates: 18.508913, 73.762646
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
