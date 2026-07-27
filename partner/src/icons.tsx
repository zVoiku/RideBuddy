// Lucide-style icon set (2px stroke), ported from the design's inline SVG set
// to react-native-svg so the partner app matches it exactly.
import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
};

const mk =
  (children: (p: { color: string; fill: string }) => React.ReactNode) =>
  ({ size = 22, color = 'currentColor', strokeWidth = 2, fill = 'none' }: IconProps) => (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children({ color, fill })}
    </Svg>
  );

export const Ico = {
  ArrowLeft: mk(() => (
    <>
      <Path d="M19 12H5" />
      <Path d="m12 19-7-7 7-7" />
    </>
  )),
  ChevronRight: mk(() => <Path d="m9 18 6-6-6-6" />),
  ChevronDown: mk(() => <Path d="m6 9 6 6 6-6" />),
  Phone: mk(() => (
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
  )),
  Bell: mk(() => (
    <>
      <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  )),
  LogOut: mk(() => (
    <>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Path d="m16 17 5-5-5-5" />
      <Path d="M21 12H9" />
    </>
  )),
  Star: mk(({ fill }) => (
    <Path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z"
      fill={fill}
    />
  )),
  Check: mk(() => <Path d="M20 6 9 17l-5-5" />),
  X: mk(() => (
    <>
      <Path d="M18 6 6 18" />
      <Path d="m6 6 12 12" />
    </>
  )),
  MapPin: mk(() => (
    <>
      <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <Circle cx="12" cy="10" r="3" />
    </>
  )),
  Clock: mk(() => (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3 2" />
    </>
  )),
  Calendar: mk(() => (
    <>
      <Rect width="18" height="18" x="3" y="4" rx="2" />
      <Path d="M3 10h18M8 2v4M16 2v4" />
    </>
  )),
  User: mk(() => (
    <>
      <Circle cx="12" cy="8" r="5" />
      <Path d="M20 21a8 8 0 0 0-16 0" />
    </>
  )),
  Shield: mk(() => (
    <>
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Path d="m9 12 2 2 4-4" />
    </>
  )),
  Car: mk(() => (
    <>
      <Path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <Circle cx="7" cy="17" r="2" />
      <Circle cx="17" cy="17" r="2" />
    </>
  )),
  FileText: mk(() => (
    <>
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
      <Path d="M9 13h6M9 17h6" />
    </>
  )),
  Alert: mk(() => (
    <>
      <Path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <Path d="M12 9v4M12 17h.01" />
    </>
  )),
  Navigation: mk(({ fill }) => <Path d="M3 11l19-9-9 19-2-8-8-2z" fill={fill} />),
  Repeat: mk(() => (
    <>
      <Path d="m17 2 4 4-4 4" />
      <Path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <Path d="m7 22-4-4 4-4" />
      <Path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </>
  )),
  Wallet: mk(() => (
    <>
      <Path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
      <Path d="M18 12a1 1 0 0 0 0 2h2v-2z" />
    </>
  )),
  Message: mk(() => (
    <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  )),
  Home: mk(() => (
    <>
      <Path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Path d="M9 22V12h6v10" />
    </>
  )),
};

export type IconName = keyof typeof Ico;
