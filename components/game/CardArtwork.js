import { useId } from "react";

const RANK_LABELS = {
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
  15: "2",
  16: "JOKER",
  17: "JOKER"
};

const SUIT_SYMBOLS = {
  S: "♠",
  H: "♥",
  C: "♣",
  D: "♦"
};

export default function CardArtwork({ card, faceDown = false }) {
  const uid = useId().replace(/:/g, "");
  const backGradientId = `cardBack-${uid}`;
  const backPatternId = `backPattern-${uid}`;
  const faceGradientId = `cardFace-${uid}`;
  const glowGradientId = `cardGlow-${uid}`;

  if (faceDown) {
    return (
      <svg viewBox="0 0 160 220" role="img" aria-label="牌背">
        <defs>
          <linearGradient id={backGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f5d49" />
            <stop offset="50%" stopColor="#0b3f34" />
            <stop offset="100%" stopColor="#072922" />
          </linearGradient>
          <pattern id={backPatternId} width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M0 8h16M8 0v16" stroke="rgba(234,209,140,0.16)" strokeWidth="1" />
            <circle cx="8" cy="8" r="2.2" fill="rgba(234,209,140,0.22)" />
          </pattern>
        </defs>
        <rect x="5" y="5" width="150" height="210" rx="18" fill="#f6efe2" />
        <rect x="10" y="10" width="140" height="200" rx="15" fill={`url(#${backGradientId})`} />
        <rect x="22" y="22" width="116" height="176" rx="12" fill={`url(#${backPatternId})`} />
        <path
          d="M80 56l20 26-20 26-20-26 20-26zm0 54l28 36-28 36-28-36 28-36z"
          fill="none"
          stroke="#e7c26f"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <circle cx="80" cy="110" r="12" fill="#e7c26f" opacity="0.75" />
      </svg>
    );
  }

  const rank = card?.rank || 3;
  const suit = card?.suit || "S";
  const isRed = suit === "H" || suit === "D";
  const accent = isRed ? "#ba2a3f" : "#18263d";
  const rankLabel = RANK_LABELS[rank] || String(rank);
  const suitLabel = SUIT_SYMBOLS[suit] || "";
  const isJoker = rank >= 16;
  const cornerRankLabel = isJoker ? (rank === 16 ? "SJ" : "BJ") : rankLabel;
  const cornerRankSize = cornerRankLabel.length > 1 ? 26 : 30;
  const cornerSuitY = cornerRankLabel.length > 1 ? 60 : 64;
  const mirroredRankY = cornerRankLabel.length > 1 ? 183 : 186;
  const mirroredSuitY = cornerRankLabel.length > 1 ? 204 : 206;

  return (
    <svg viewBox="0 0 160 220" role="img" aria-label={card?.label || "撲克牌"}>
      <defs>
        <linearGradient id={faceGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fffefb" />
          <stop offset="100%" stopColor="#f2ecdf" />
        </linearGradient>
        <linearGradient id={glowGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fdf8ee" />
          <stop offset="100%" stopColor={isRed ? "#ffe1dd" : "#dee8ff"} />
        </linearGradient>
      </defs>
      <rect x="5" y="5" width="150" height="210" rx="18" fill="#f6efe2" />
      <rect x="10" y="10" width="140" height="200" rx="15" fill={`url(#${faceGradientId})`} />
      <rect x="16" y="16" width="128" height="188" rx="12" fill={`url(#${glowGradientId})`} opacity="0.58" />

      <g fill={accent}>
        <text x="22" y="42" fontSize={cornerRankSize} fontWeight="700" fontFamily="Georgia, serif">
          {cornerRankLabel}
        </text>
        <text x="25" y={cornerSuitY} fontSize={24}>
          {isJoker ? (rank === 16 ? "◈" : "◆") : suitLabel}
        </text>
      </g>
      <g fill={accent}>
        <text
          x="138"
          y={mirroredRankY}
          textAnchor="end"
          fontSize={cornerRankSize}
          fontWeight="700"
          fontFamily="Georgia, serif"
        >
          {cornerRankLabel}
        </text>
        <text x="136" y={mirroredSuitY} textAnchor="end" fontSize={22}>
          {isJoker ? (rank === 16 ? "◈" : "◆") : suitLabel}
        </text>
      </g>

      {isJoker ? (
        <g>
          <text
            x="80"
            y="84"
            fontSize="18"
            textAnchor="middle"
            letterSpacing="5"
            fill={rank === 17 ? "#a1192b" : "#304d7d"}
            fontWeight="700"
          >
            {rank === 17 ? "BIG" : "SMALL"}
          </text>
          <text
            x="80"
            y="122"
            fontSize="54"
            textAnchor="middle"
            fill={rank === 17 ? "#cf3f47" : "#4968b7"}
          >
            {rank === 17 ? "🃏" : "✦"}
          </text>
          <text
            x="80"
            y="164"
            fontSize="26"
            textAnchor="middle"
            fill={rank === 17 ? "#771421" : "#24395c"}
            fontFamily="Georgia, serif"
          >
            JOKER
          </text>
        </g>
      ) : (
        <g fill={accent}>
          <text
            x="80"
            y="124"
            fontSize={70}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {suitLabel}
          </text>
          <text
            x="80"
            y="172"
            fontSize={24}
            textAnchor="middle"
            fontFamily="Georgia, serif"
            opacity="0.82"
          >
            {rankLabel}
          </text>
        </g>
      )}
    </svg>
  );
}
