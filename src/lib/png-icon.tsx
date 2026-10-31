import { ImageResponse } from 'next/og';

export function renderGoalOsPng(size: number, maskable: boolean = false) {
  const padding = maskable ? Math.round(size * 0.15) : Math.round(size * 0.08);
  const innerSize = size - padding * 2;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0F766E',
          borderRadius: maskable ? 0 : Math.round(size * 0.22),
        }}
      >
        <div
          style={{
            width: innerSize,
            height: innerSize,
            borderRadius: '9999px',
            border: `${Math.max(8, Math.round(size * 0.055))}px solid #99F6E4`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: Math.round(size * 0.34),
            fontWeight: 800,
          }}
        >
          G
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
    }
  );
}
