import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../theme';
import { FONT } from '../../constants/ui';

export default function AvatarDropdown({ user, userProfile, onSignOut, onToggleTheme, isDark }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const name = userProfile?.name || user?.displayName || 'Usuario';
  const photo = userProfile?.photo || user?.photoURL;

  return (
    <div ref={ref} style={{ position: 'relative', fontFamily: FONT }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '8px 4px',
          borderRadius: 8,
          width: '100%',
        }}
      >
        {photo
          ? <img src={photo} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} alt="" />
          : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#4F7FFA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 600 }}>{name[0]}</div>
        }
        <span style={{ fontSize: 13, color: colors.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>{name}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          right: 0,
          background: colors.card,
          border: `1px solid ${colors.navBorder}`,
          borderRadius: 12,
          padding: '8px 0',
          marginBottom: 4,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          zIndex: 100,
        }}>
          {[
            { label: isDark ? '☀️  Modo claro' : '🌙  Modo oscuro', action: () => { onToggleTheme(); setOpen(false); } },
            { label: '🚪  Cerrar sesión', action: () => { onSignOut(); setOpen(false); }, danger: true },
          ].map(item => (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 13,
                fontFamily: FONT,
                color: item.danger ? '#ef4444' : colors.text,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
