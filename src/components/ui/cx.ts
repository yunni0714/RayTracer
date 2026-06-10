// zero-dep classnames 조이너 (clsx 미설치)
export const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');
