import React from 'react';

/** Public-path brand mark — keep in sync with `public/favicon.svg`. */
export const APP_LOGO_SRC = '/favicon.svg';

interface AppLogoMarkProps {
  size?: number;
  className?: string;
  alt?: string;
}

export const AppLogoMark: React.FC<AppLogoMarkProps> = ({
  size = 32,
  className,
  alt = '',
}) => (
  <img
    src={APP_LOGO_SRC}
    alt={alt}
    width={size}
    height={size}
    draggable={false}
    decoding="async"
    className={className}
  />
);
