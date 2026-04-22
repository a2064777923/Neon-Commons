export default function GameIcon({ gameKey, className = "" }) {
  if (gameKey === "gomoku") {
    return (
      <svg viewBox="0 0 160 160" role="img" aria-label="五子棋图标" className={className}>
        <defs>
          <linearGradient id="gomokuBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#174433" />
            <stop offset="100%" stopColor="#0d2218" />
          </linearGradient>
          <linearGradient id="gomokuBoard" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5d28b" />
            <stop offset="100%" stopColor="#b88233" />
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="144" height="144" rx="34" fill="url(#gomokuBg)" />
        <rect x="30" y="30" width="100" height="100" rx="20" fill="url(#gomokuBoard)" />
        {Array.from({ length: 5 }).map((_, index) => (
          <g key={`gomoku-grid-${index}`} stroke="#5d3b10" strokeWidth="2.5" opacity="0.78">
            <line x1={42 + index * 19} y1="42" x2={42 + index * 19} y2="118" />
            <line x1="42" y1={42 + index * 19} x2="118" y2={42 + index * 19} />
          </g>
        ))}
        <circle cx="80" cy="61" r="10" fill="#11161f" />
        <circle cx="61" cy="80" r="10" fill="#f8f5ef" stroke="#a38f70" strokeWidth="2" />
        <circle cx="99" cy="80" r="10" fill="#11161f" />
        <circle cx="80" cy="99" r="10" fill="#f8f5ef" stroke="#a38f70" strokeWidth="2" />
        <circle cx="80" cy="80" r="10" fill="#11161f" />
      </svg>
    );
  }

  if (gameKey === "chinesecheckers") {
    return (
      <svg viewBox="0 0 160 160" role="img" aria-label="跳棋图标" className={className}>
        <defs>
          <linearGradient id="jumpBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#17335d" />
            <stop offset="100%" stopColor="#0c1c34" />
          </linearGradient>
          <linearGradient id="jumpLine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffd39f" />
            <stop offset="100%" stopColor="#c78542" />
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="144" height="144" rx="34" fill="url(#jumpBg)" />
        <path
          d="M80 28l16 22h28l-22 16 9 27-25-15-6 30-6-30-25 15 9-27-22-16h28z"
          fill="none"
          stroke="url(#jumpLine)"
          strokeWidth="7"
          strokeLinejoin="round"
        />
        <g>
          <circle cx="80" cy="42" r="7.5" fill="#ff7f5f" />
          <circle cx="63" cy="66" r="7.5" fill="#ffb35b" />
          <circle cx="97" cy="66" r="7.5" fill="#ffd55d" />
          <circle cx="80" cy="92" r="7.5" fill="#57d982" />
          <circle cx="48" cy="92" r="7.5" fill="#72aaff" />
          <circle cx="112" cy="92" r="7.5" fill="#bc86ff" />
        </g>
      </svg>
    );
  }

  if (gameKey === "sokoban") {
    return (
      <svg viewBox="0 0 160 160" role="img" aria-label="推箱子图标" className={className}>
        <defs>
          <linearGradient id="sokobanBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#173a2a" />
            <stop offset="100%" stopColor="#091b13" />
          </linearGradient>
          <linearGradient id="sokobanFloor" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f3d88a" />
            <stop offset="100%" stopColor="#b9812d" />
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="144" height="144" rx="34" fill="url(#sokobanBg)" />
        <rect x="34" y="34" width="92" height="92" rx="16" fill="url(#sokobanFloor)" />
        <g fill="#6f4316">
          <rect x="44" y="44" width="18" height="18" rx="4" />
          <rect x="98" y="44" width="18" height="18" rx="4" />
          <rect x="44" y="98" width="18" height="18" rx="4" />
        </g>
        <rect x="69" y="68" width="30" height="30" rx="6" fill="#d36f2b" stroke="#7f350f" strokeWidth="4" />
        <path d="M84 74v18M75 83h18" stroke="#ffe9c0" strokeWidth="4" strokeLinecap="round" />
        <circle cx="112" cy="108" r="10" fill="#f7f3d1" stroke="#ad9152" strokeWidth="4" />
        <path d="M52 74c6-10 16-15 30-16" stroke="#f7f3d1" strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M79 52l9 4-7 8" fill="none" stroke="#f7f3d1" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (gameKey === "reversi") {
    return (
      <svg viewBox="0 0 160 160" role="img" aria-label="黑白棋图标" className={className}>
        <defs>
          <linearGradient id="reversiBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#174233" />
            <stop offset="100%" stopColor="#081912" />
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="144" height="144" rx="34" fill="url(#reversiBg)" />
        <rect x="30" y="30" width="100" height="100" rx="20" fill="#2d7b53" />
        {Array.from({ length: 5 }).map((_, index) => (
          <g key={`reversi-grid-${index}`} stroke="#d3f0dd" strokeWidth="2" opacity="0.38">
            <line x1={50 + index * 15} y1="42" x2={50 + index * 15} y2="118" />
            <line x1="42" y1={50 + index * 15} x2="118" y2={50 + index * 15} />
          </g>
        ))}
        <g>
          <circle cx="67" cy="67" r="12" fill="#f8f7f3" stroke="#b9b4a7" strokeWidth="3" />
          <circle cx="93" cy="67" r="12" fill="#0f1720" stroke="#3b4a5a" strokeWidth="3" />
          <circle cx="67" cy="93" r="12" fill="#0f1720" stroke="#3b4a5a" strokeWidth="3" />
          <circle cx="93" cy="93" r="12" fill="#f8f7f3" stroke="#b9b4a7" strokeWidth="3" />
          <path d="M114 48c7 11 9 24 4 38" stroke="#ffd97a" strokeWidth="5" strokeLinecap="round" fill="none" />
          <path d="M118 90l-13-3 7-11" fill="none" stroke="#ffd97a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    );
  }

  if (gameKey === "undercover") {
    return (
      <svg viewBox="0 0 160 160" role="img" aria-label="谁是卧底图标" className={className}>
        <defs>
          <linearGradient id="undercoverBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3d1020" />
            <stop offset="100%" stopColor="#12070d" />
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="144" height="144" rx="34" fill="url(#undercoverBg)" />
        <g transform="translate(30 38)">
          <rect x="0" y="10" width="44" height="56" rx="14" fill="#f7e1bc" />
          <rect x="28" y="0" width="44" height="66" rx="14" fill="#f6f1e8" />
          <rect x="56" y="16" width="44" height="50" rx="14" fill="#d1434f" />
          <path d="M80 28l4 10 10 1-8 7 3 10-9-5-9 5 3-10-8-7 10-1z" fill="#ffe49a" />
          <circle cx="22" cy="84" r="10" fill="#f7e1bc" />
          <circle cx="50" cy="84" r="10" fill="#f6f1e8" />
          <circle cx="78" cy="84" r="10" fill="#d1434f" />
        </g>
      </svg>
    );
  }

  if (gameKey === "werewolf") {
    return (
      <svg viewBox="0 0 160 160" role="img" aria-label="狼人杀图标" className={className}>
        <defs>
          <linearGradient id="wolfSky" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2a1538" />
            <stop offset="100%" stopColor="#0f111d" />
          </linearGradient>
          <linearGradient id="wolfMoon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff1bc" />
            <stop offset="100%" stopColor="#d6a23d" />
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="144" height="144" rx="34" fill="url(#wolfSky)" />
        <circle cx="112" cy="46" r="22" fill="url(#wolfMoon)" />
        <path
          d="M36 122c10-32 28-46 56-52 7-11 14-22 23-34l-1 28c8 4 14 11 18 20-9-5-19-8-27-8 4 10 4 19-1 27-9 15-23 23-43 24H36v-5z"
          fill="#e8dcc4"
        />
        <path
          d="M64 94c4-2 9-2 13 0-2 4-5 6-10 7-2-1-3-4-3-7zm38-10c4-1 7 0 10 3-2 3-5 5-9 5-2-2-2-5-1-8z"
          fill="#0e0d14"
        />
        <path d="M72 111c8 5 18 5 30 0-2 8-7 13-15 16-8-3-13-8-15-16z" fill="#8b2230" />
      </svg>
    );
  }

  if (gameKey === "avalon") {
    return (
      <svg viewBox="0 0 160 160" role="img" aria-label="阿瓦隆图标" className={className}>
        <defs>
          <linearGradient id="avalonBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0c2048" />
            <stop offset="100%" stopColor="#102941" />
          </linearGradient>
          <linearGradient id="avalonGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffe39a" />
            <stop offset="100%" stopColor="#d7a037" />
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="144" height="144" rx="34" fill="url(#avalonBg)" />
        <path
          d="M80 24l42 16v28c0 28-16 50-42 68C54 118 38 96 38 68V40l42-16z"
          fill="none"
          stroke="url(#avalonGold)"
          strokeWidth="8"
        />
        <path
          d="M79 45l8 18 20 2-15 13 5 20-18-10-18 10 5-20-15-13 20-2 8-18z"
          fill="url(#avalonGold)"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 160 160" role="img" aria-label="斗地主图标" className={className}>
      <defs>
        <linearGradient id="ddzBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#144d38" />
          <stop offset="100%" stopColor="#0b231a" />
        </linearGradient>
        <linearGradient id="ddzGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe7ac" />
          <stop offset="100%" stopColor="#cc8a16" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="144" height="144" rx="34" fill="url(#ddzBg)" />
      <g transform="translate(34 26) rotate(-8)">
        <rect x="0" y="14" width="56" height="82" rx="10" fill="#fffaf0" />
        <text x="11" y="34" fontSize="18" fontWeight="700" fill="#b1273f">
          A
        </text>
        <text x="11" y="52" fontSize="16" fill="#b1273f">
          ♥
        </text>
      </g>
      <g transform="translate(67 24) rotate(4)">
        <rect x="0" y="0" width="56" height="82" rx="10" fill="#fffaf0" />
        <text x="10" y="22" fontSize="16" fontWeight="700" fill="#19263f">
          10
        </text>
        <text x="14" y="40" fontSize="15" fill="#19263f">
          ♠
        </text>
      </g>
      <path
        d="M80 54l10 13-10 13-10-13 10-13zm0 30l14 18-14 18-14-18 14-18z"
        fill="none"
        stroke="url(#ddzGold)"
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
