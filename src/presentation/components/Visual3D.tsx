import type { ComponentProps } from 'react';
import { Scene3D } from '../three/Scene3D';
import { useDeck } from './deck';

/** Renders estáticos generados desde el propio modelo 3D (npm run renders). */
const RENDERS = import.meta.glob('../renders/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const renderUrl = (name: string) => RENDERS[`../renders/${name}.jpg`];

/**
 * En pantalla: escena 3D interactiva. Al imprimir (o si la diapositiva no está
 * activa): imagen renderizada del mismo modelo en un estado representativo.
 */
export function Visual3D({ render, alt, ...scene }: ComponentProps<typeof Scene3D> & { render: string; alt: string }) {
  const { print, active } = useDeck();
  if (print || !active) {
    const url = renderUrl(render);
    return url ? (
      <img src={url} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', position: 'relative' }} />
    ) : (
      <div className="scene-fallback">{alt}</div>
    );
  }
  return <Scene3D {...scene} />;
}
