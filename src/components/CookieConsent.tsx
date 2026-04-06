import { useState, useEffect } from 'react';
import { Cookie } from 'lucide-react';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasConsented = localStorage.getItem('svg-cleaner-cookies-accepted');
    if (!hasConsented) {
      // Small delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('svg-cleaner-cookies-accepted', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-sm w-full bg-card border border-border shadow-2xl rounded-2xl p-5 z-[100] animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-start gap-4 mb-4">
        <div className="bg-primary/10 p-2.5 rounded-full text-primary shrink-0">
          <Cookie className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-semibold text-sm mb-1 text-foreground">Utilisation des cookies obligatoires</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Cette application utilise exclusivement le stockage local de votre navigateur pour sauvegarder vos préférences et votre historique d'édition. Ces cookies fonctionnels sont nécessaires au bon fonctionnement de l'application. Aucune donnée n'est envoyée vers nos serveurs.
          </p>
        </div>
      </div>

      <div className="flex gap-2 justify-end mt-2">
        <button 
          onClick={acceptCookies}
          className="w-full text-sm font-medium px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          J'ai compris et j'accepte
        </button>
      </div>
    </div>
  );
}
