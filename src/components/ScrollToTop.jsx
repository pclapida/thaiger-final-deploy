import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Fuerzo a react router a mandar la ventanta X:0, Y:0 de manera instantánea
    window.scrollTo({
        top: 0,
        left: 0,
        behavior: "instant" 
    });
  }, [pathname]);

  return null;
}
