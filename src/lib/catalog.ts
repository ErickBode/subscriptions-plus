import type { Icon } from './types';

export interface Service {
  id: string;
  name: string;
  /** Glyph registry key: a simple-icons slug or an Iconify key like `ri:openai-fill`. */
  glyph?: string;
  color: string;
  category: string;
  popular?: boolean;
}

// Popular first, then the full alphabetical catalog.
const POPULAR: Service[] = [
  { id: 'youtube', name: 'YouTube', glyph: 'youtube', color: '#FF0000', category: 'streaming' },
  { id: 'spotify', name: 'Spotify', glyph: 'spotify', color: '#1ED760', category: 'music' },
  { id: 'netflix', name: 'Netflix', glyph: 'netflix', color: '#E50914', category: 'streaming' },
  { id: 'linkedin', name: 'LinkedIn', glyph: 'ri:linkedin-fill', color: '#0A66C2', category: 'services' },
  { id: 'cursor', name: 'Cursor', glyph: 'cursor', color: '#3A3A3A', category: 'ai' },
  { id: 'claude', name: 'Claude', glyph: 'claude', color: '#D97757', category: 'ai' },
  { id: 'chatgpt', name: 'ChatGPT', glyph: 'ri:openai-fill', color: '#10A37F', category: 'ai' },
  { id: 'icloud', name: 'Apple iCloud', glyph: 'icloud', color: '#3693F3', category: 'apps' },
  { id: 'appleone', name: 'Apple One', glyph: 'apple', color: '#555555', category: 'services' },
  { id: 'applemusic', name: 'Apple Music', glyph: 'applemusic', color: '#FA243C', category: 'music' },
  { id: 'primevideo', name: 'Amazon Prime Video', glyph: 'streamline-logos:amazon-prime-video-logo-1-solid', color: '#1A98FF', category: 'streaming' },
  { id: '1password', name: '1Password', glyph: '1password', color: '#145FE4', category: 'apps' },
].map((s) => ({ ...s, popular: true }));

const ALL: Service[] = [
  { id: 'adobecc', name: 'Adobe Cloud', glyph: 'tabler:brand-adobe', color: '#EB1000', category: 'apps' },
  { id: 'amazonmusic', name: 'Amazon Music', glyph: 'fa6-brands:amazon', color: '#25D1DA', category: 'music' },
  { id: 'amazonprime', name: 'Amazon Prime', glyph: 'fa6-brands:amazon', color: '#1A98FF', category: 'services' },
  { id: 'applearcade', name: 'Apple Arcade', glyph: 'applearcade', color: '#E8394B', category: 'games' },
  { id: 'applecare', name: 'Apple Care+', glyph: 'apple', color: '#E23B3B', category: 'services' },
  { id: 'appledeveloper', name: 'Apple Developer', glyph: 'apple', color: '#2D7FF9', category: 'apps' },
  { id: 'applefitness', name: 'Apple Fitness+', glyph: 'apple', color: '#A6FF00', category: 'services' },
  { id: 'appletv', name: 'Apple TV', glyph: 'appletv', color: '#2A2A2A', category: 'streaming' },
  { id: 'audible', name: 'Audible', glyph: 'audible', color: '#F8991C', category: 'learning' },
  { id: 'bumble', name: 'Bumble', glyph: 'tabler:hexagon', color: '#FFC629', category: 'services' },
  { id: 'calm', name: 'Calm', glyph: 'tabler:leaf', color: '#4A7BC4', category: 'services' },
  { id: 'canva', name: 'Canva', glyph: 'bxl:canva', color: '#00C4CC', category: 'apps' },
  { id: 'crunchyroll', name: 'Crunchyroll', glyph: 'crunchyroll', color: '#FF5E00', category: 'streaming' },
  { id: 'dndbeyond', name: 'D&D Beyond', glyph: 'dungeonsanddragons', color: '#E40712', category: 'games' },
  { id: 'disneyplus', name: 'Disney+', glyph: 'tabler:brand-disney', color: '#113CCF', category: 'streaming' },
  { id: 'doordash', name: 'DoorDash', glyph: 'doordash', color: '#FF3008', category: 'services' },
  { id: 'dropbox', name: 'Dropbox', glyph: 'dropbox', color: '#0061FF', category: 'apps' },
  { id: 'duolingo', name: 'Duolingo', glyph: 'duolingo', color: '#58CC02', category: 'learning' },
  { id: 'eaplay', name: 'EA Play', glyph: 'ea', color: '#FF4747', category: 'games' },
  { id: 'etsy', name: 'Etsy Plus', glyph: 'etsy', color: '#F16521', category: 'services' },
  { id: 'figma', name: 'Figma', glyph: 'figma', color: '#F24E1E', category: 'apps' },
  { id: 'framer', name: 'Framer', glyph: 'framer', color: '#0055FF', category: 'apps' },
  { id: 'fubo', name: 'Fubotv', glyph: 'fubo', color: '#C83D1E', category: 'streaming' },
  { id: 'gemini', name: 'Gemini', glyph: 'googlegemini', color: '#8E75B2', category: 'ai' },
  { id: 'googledrive', name: 'Google Drive', glyph: 'googledrive', color: '#1FA463', category: 'apps' },
  { id: 'googleone', name: 'Google One', glyph: 'ri:google-fill', color: '#4285F4', category: 'apps' },
  { id: 'googleplay', name: 'Google Play', glyph: 'googleplay', color: '#01875F', category: 'services' },
  { id: 'grammarly', name: 'Grammarly', glyph: 'grammarly', color: '#027E6F', category: 'ai' },
  { id: 'hbomax', name: 'HBO Max', glyph: 'hbomax', color: '#5822B4', category: 'streaming' },
  { id: 'headspace', name: 'Headspace', glyph: 'headspace', color: '#F47D31', category: 'services' },
  { id: 'hinge', name: 'Hinge', glyph: 'tabler:heart', color: '#555555', category: 'services' },
  { id: 'hulu', name: 'Hulu', glyph: 'tabler:device-tv', color: '#1CE783', category: 'streaming' },
  { id: 'lyftpink', name: 'Lyft Pink', glyph: 'lyft', color: '#FF00BF', category: 'services' },
  { id: 'm365', name: 'Microsoft 365', glyph: 'fa6-brands:microsoft', color: '#D83B01', category: 'apps' },
  { id: 'midjourney', name: 'Midjourney', glyph: 'tabler:sailboat', color: '#6E6E6E', category: 'ai' },
  { id: 'nintendo', name: 'Nintendo Online', glyph: 'mdi:nintendo-switch', color: '#E60012', category: 'games' },
  { id: 'nordvpn', name: 'NordVPN', glyph: 'nordvpn', color: '#4687FF', category: 'apps' },
  { id: 'notion', name: 'Notion', glyph: 'notion', color: '#4A4A4A', category: 'apps' },
  { id: 'obsidian', name: 'Obsidian', glyph: 'obsidian', color: '#7C3AED', category: 'apps' },
  { id: 'owlbear', name: 'Owlbear Rodeo', glyph: 'mdi:owl', color: '#5B5FD6', category: 'games' },
  { id: 'pandora', name: 'Pandora', glyph: 'pandora', color: '#224099', category: 'music' },
  { id: 'paramountplus', name: 'Paramount+', glyph: 'paramountplus', color: '#0064FF', category: 'streaming' },
  { id: 'patreon', name: 'Patreon', glyph: 'patreon', color: '#4A4A4A', category: 'creators' },
  { id: 'peloton', name: 'Peloton Digital', glyph: 'peloton', color: '#3A3A3A', category: 'services' },
  { id: 'pimsleur', name: 'Pimsleur', glyph: 'tabler:language', color: '#2E5CB8', category: 'learning' },
  { id: 'psplus', name: 'Playstation Plus', glyph: 'playstation', color: '#0070D1', category: 'games' },
  { id: 'revolut', name: 'Revolut', glyph: 'revolut', color: '#3A3A3A', category: 'services' },
  { id: 'scribd', name: 'Scribd', glyph: 'tabler:book', color: '#1E7B85', category: 'learning' },
  { id: 'setapp', name: 'Setapp', glyph: 'setapp', color: '#8C6E5A', category: 'apps' },
  { id: 'skillshare', name: 'Skillshare', glyph: 'skillshare', color: '#00C26E', category: 'learning' },
  { id: 'slack', name: 'Slack', glyph: 'fa6-brands:slack', color: '#611F69', category: 'apps' },
  { id: 'strava', name: 'Strava', glyph: 'strava', color: '#FC4C02', category: 'services' },
  { id: 't3chat', name: 'T3 Chat', glyph: 'tabler:message-chatbot', color: '#C2477F', category: 'ai' },
  { id: 'telegram', name: 'Telegram', glyph: 'telegram', color: '#26A5E4', category: 'apps' },
  { id: 'nyt', name: 'The New York Times', glyph: 'newyorktimes', color: '#3A3A3A', category: 'services' },
  { id: 'tinder', name: 'Tinder', glyph: 'tinder', color: '#FF6B6B', category: 'services' },
  { id: 'trello', name: 'Trello', glyph: 'trello', color: '#0052CC', category: 'apps' },
  { id: 'twitch', name: 'Twitch', glyph: 'twitch', color: '#9146FF', category: 'creators' },
  { id: 'x', name: 'Twitter/X', glyph: 'x', color: '#3A3A3A', category: 'services' },
  { id: 'uberone', name: 'Uber One', glyph: 'uber', color: '#3A3A3A', category: 'services' },
  { id: 'vodafone', name: 'Vodafone', glyph: 'vodafone', color: '#E60000', category: 'services' },
  { id: 'walmart', name: 'Walmart+', glyph: 'tabler:brand-walmart', color: '#0071DC', category: 'services' },
  { id: 'waterminder', name: 'Water Minder', glyph: 'tabler:droplet', color: '#3AA0F2', category: 'services' },
  { id: 'whoop', name: 'WHOOP', glyph: 'tabler:heart-rate-monitor', color: '#3A3A3A', category: 'services' },
  { id: 'wwf', name: 'WWF', glyph: 'tabler:paw', color: '#3A3A3A', category: 'other' },
  { id: 'xbox', name: 'Xbox Game Pass', glyph: 'fa6-brands:xbox', color: '#107C10', category: 'games' },
  { id: 'youtubemusic', name: 'YouTube Music', glyph: 'youtubemusic', color: '#FF0000', category: 'music' },
  { id: 'zoom', name: 'Zoom', glyph: 'zoom', color: '#0B5CFF', category: 'apps' },
];

export const POPULAR_SERVICES = POPULAR;
export const ALL_SERVICES = [...POPULAR, ...ALL]
  .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i)
  .sort((a, b) => a.name.localeCompare(b.name));

export function serviceIcon(s: Service): Icon {
  return s.glyph ? { type: 'simple', slug: s.glyph } : { type: 'letter' };
}

/** Matches a typed name to a catalog service (used for custom names). */
export function findService(name: string): Service | undefined {
  const n = name.trim().toLowerCase();
  return ALL_SERVICES.find((s) => s.name.toLowerCase() === n);
}

/** Stable colour for names that are not in the catalog. */
export function colorForName(name: string): string {
  const palette = ['#E5534B', '#E0823D', '#D4A72C', '#57AB5A', '#39A0B4', '#4A8FE7', '#8E6FD8', '#C9608F'];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}
