import { useTheme } from '../../theme';
import { FONT } from '../../constants/ui';
import AvatarDropdown from './AvatarDropdown';

const NAV_ITEMS = [
  { key: 'home',     icon: '🏠', label: 'Inicio' },
  { key: 'saldos',   icon: '⚖️', label: 'Saldos' },
  { key: 'graficos', icon: '📊', label: 'Gráficos' },
  { key: 'ajustes',  icon: '⚙️', label: 'Ajustes' },
];

export default function Sidebar({ activeTab, onTabChange, account, collapsed, onToggleCollapse, user, userProfile, onSignOut, onToggleTheme, isDark }) {
  const { colors } = useTheme();

  return (
    <div style={{
      width: collapsed ? 64 : 220,
      minWidth: collapsed ? 64 : 220,
      height: '100dvh',
      background: colors.card,
      borderRight: `1px solid ${colors.navBorder}`,
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.2s ease',
      fontFamily: FONT,
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* Cuenta */}
      <div style={{ padding: collapsed ? '20px 0' : '20px 16px', textAlign: collapsed ? 'center' : 'left' }}>
        <div style={{ fontSize: collapsed ? 24 : 20 }}>{account?.emoji || '💰'}</div>
        {!collapsed && (
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {account?.name || ''}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => onTabChange(item.key)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: collapsed ? '12px 0' : '12px 16px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              background: activeTab === item.key ? '#4F7FFA18' : 'transparent',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              color: activeTab === item.key ? '#4F7FFA' : colors.textMuted,
              fontFamily: FONT,
              fontSize: 14,
              fontWeight: activeTab === item.key ? 600 : 400,
              transition: 'background 0.15s',
            }}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Toggle collapse */}
      <button
        type="button"
        onClick={onToggleCollapse}
        style={{
          position: 'absolute',
          top: 20,
          right: -12,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: colors.card,
          border: `1px solid ${colors.navBorder}`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: colors.textMuted,
          zIndex: 10,
        }}
      >
        {collapsed ? '›' : '‹'}
      </button>

      {/* Avatar */}
      <div style={{ padding: collapsed ? '12px 0' : '8px 12px', borderTop: `1px solid ${colors.navBorder}` }}>
        {collapsed
          ? <div style={{ display: 'flex', justifyContent: 'center' }}>
              {(userProfile?.photo || user?.photoURL)
                ? <img src={userProfile?.photo || user?.photoURL} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#4F7FFA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 600 }}>{(userProfile?.name || user?.displayName || 'U')[0]}</div>
              }
            </div>
          : <AvatarDropdown user={user} userProfile={userProfile} onSignOut={onSignOut} onToggleTheme={onToggleTheme} isDark={isDark} />
        }
      </div>
    </div>
  );
}
