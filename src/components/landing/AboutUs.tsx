import React from 'react';
import { Info, MapPin, Phone, Target, Award, Users } from 'lucide-react';

export const AboutUs: React.FC = () => {
  return (
    <section id="about" className="py-20 bg-white text-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">About Us</h2>
          <div className="w-20 h-1 bg-amber-500 mx-auto rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h3 className="text-2xl font-bold text-slate-800 mb-6">Elite24 Property Consulting Company</h3>
            <p className="text-lg text-slate-600 mb-6 leading-relaxed">
              Elite24 Property Consulting Company is a leading real estate consulting company in Pune, Maharashtra, specializing in residential and commercial properties across the city's most rapidly developing locations.
            </p>
            <p className="text-slate-600 mb-8 leading-relaxed">
              Located at U-7 Runwal Platinum, Bavdhan, Pune, Maharashtra 411021, we help homebuyers, investors, and businesses discover premium real estate opportunities with professional guidance and personalized property solutions.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">Our Focus</h4>
                  <p className="text-slate-600 text-sm">Bhugaon, Bavdhan, Sus, Mahalunghe, Baner, Balewadi, Pashan, and more.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">Specialization</h4>
                  <p className="text-slate-600 text-sm">Premium 2 BHK, 3 BHK, and 4 BHK flats, luxury apartments, and commercial spaces.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="text-xl font-bold text-slate-800 mb-4">Our Key Service Locations</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                'Bhugaon', 'Bavdhan', 'Sus', 'Mahalunghe', 'Baner', 
                'Balewadi', 'Pashan', 'Kothrud', 'Warje', 'Tathwade', 
                'Ravet', 'Punawale', 'Kiwale', 'Mamurdi'
              ].map((location) => (
                <div key={location} className="flex items-center gap-2 text-slate-600 text-sm">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                  {location}
                </div>
              ))}
            </div>
            
            <div className="mt-8 pt-8 border-t border-slate-200">
              <p className="text-slate-600 italic">
                "Whether you are searching for luxury apartments in Baner, affordable flats in Punawale, or commercial office spaces in Kothrud, we provide carefully selected options that suit every budget."
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 bg-slate-50 rounded-xl text-center border border-slate-100">
            <div className="w-12 h-12 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-800 mb-2">Expert Guidance</h4>
            <p className="text-slate-600 text-sm">Professional real estate consulting services tailored to your investment goals.</p>
          </div>
          <div className="p-6 bg-slate-50 rounded-xl text-center border border-slate-100">
            <div className="w-12 h-12 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-800 mb-2">Strategic Locations</h4>
            <p className="text-slate-600 text-sm">Focusing on high-growth areas near Hinjewadi IT Park and Pune IT hubs.</p>
          </div>
          <div className="p-6 bg-slate-50 rounded-xl text-center border border-slate-100">
            <div className="w-12 h-12 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-800 mb-2">End-to-End Solutions</h4>
            <p className="text-slate-600 text-sm">Property buying assistance, documentation support, and investment consultation.</p>
          </div>
        </div>
      </div>
    </section>
  );
};
