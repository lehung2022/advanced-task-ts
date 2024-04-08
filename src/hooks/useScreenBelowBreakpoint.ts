import { useEffect, useState } from "react";

/**
 * A custom React hook to determine if the current device is below a certain screen width
 * based on the screen width.
 * @param [breakpoint=400] - The breakpoint in pixels at which the message is displayed.
 * @returns {boolean} - A boolean value indicating whether the screen width is below the specified breakpoint.
 */
export const useScreenBelowBreakpoint = (breakpoint = 400): boolean => {
  const [isBelowBreakpoint, setIsBelowBreakpoint] = useState<boolean>(false);

  const checkScreenSize = () => {
    setIsBelowBreakpoint(window.innerWidth < breakpoint);
  };

  useEffect(() => {
    checkScreenSize();
    const handleResize = () => checkScreenSize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [breakpoint]);

  return isBelowBreakpoint;
};
