import React from 'react';

interface PhotofactoWordmarkProps {
  className?: string;
  /** Use on-dark variant (PHOTO becomes white instead of charcoal) */
  onDark?: boolean;
  /** Show tagline DOCUMENTER · VERIFIER · AVANCER */
  tagline?: boolean;
}

/**
 * Photofacto logotype — "PHOTO" en charbon + "FACTO" en orange,
 * police condensée chunky (Anton), ligne typographique du logo.
 *
 * Usage:
 *   <PhotofactoWordmark className="text-5xl" />
 *   <PhotofactoWordmark className="text-6xl" tagline />
 *   <PhotofactoWordmark className="text-2xl" onDark />   // footer sombre
 */
const PhotofactoWordmark: React.FC<PhotofactoWordmarkProps> = ({
  className = '',
  onDark = false,
  tagline = false,
}) => {
  return (
    <span className={`inline-flex flex-col items-center ${onDark ? 'on-dark' : ''} ${className}`}>
      <span className={`wordmark-photofacto ${onDark ? 'on-dark' : ''}`}>
        <span className="wm-photo">PHOTO</span>
        <span className="wm-facto">FACTO</span>
      </span>
      {tagline && (
        <span className="wordmark-tagline">
          Documenter<span className="tagline-dot">.</span>
          &nbsp;Verifier<span className="tagline-dot">.</span>
          &nbsp;Avancer<span className="tagline-dot">.</span>
        </span>
      )}
    </span>
  );
};

export default PhotofactoWordmark;
