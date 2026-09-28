import type { Hint } from '../../core/errors';
import { GESTURES } from '../../core/gestures';
import type { Finger } from '../../core/vision/types';
import { en } from './en';
import { ru } from './ru';

export type Locale = 'ru' | 'en';
export const getText = (locale: Locale) => locale === 'en' ? en : ru;

export function getHintText(locale: Locale, hint: Hint): string {
  const t = getText(locale);
  const finger = hint.params?.finger as Finger | undefined;
  const fingerName = finger && finger in t.fingers ? t.fingers[finger] : '';
  const expected = String(hint.params?.gestures ?? '').split(',').filter((value): value is (typeof GESTURES)[number] => GESTURES.some(gesture => gesture === value));
  if (locale === 'ru') {
    switch (hint.code) {
      case 'HAND_MISSING': return 'Поднимите руку в кадр';
      case 'TOO_FAR': return 'Поднесите руку ближе';
      case 'TOO_CLOSE': return 'Отодвиньте руку немного дальше';
      case 'NEAR_EDGE': return 'Сдвиньте руку к центру';
      case 'TOO_DARK': return 'Слишком темно — включите свет';
      case 'KEEP_STILL': return 'Держите руку неподвижно';
      case 'FACE_CAMERA': return 'Поверните ладонь к камере';
      case 'EXTEND_FINGER': return `Выпрямите ${fingerName}`;
      case 'FOLD_FINGER': return finger === 'thumb' ? 'Прижмите большой палец' : `Согните ${fingerName}`;
      case 'THUMB_UP': return 'Поднимите большой палец выше';
      case 'THUMB_DOWN': return 'Опустите большой палец вниз';
      case 'EXPECTED_GESTURES': return expected.includes('YES') && expected.includes('NO')
        ? 'Сейчас ответьте: 👍 Да или 👎 Нет'
        : `Сейчас покажите: ${expected.map(gesture => t.gestures[gesture].label).join(' или ')}`;
      default: return 'Покажите жест ещё раз';
    }
  }
  switch (hint.code) {
    case 'HAND_MISSING': return 'Raise your hand into the frame';
    case 'TOO_FAR': return 'Move your hand closer';
    case 'TOO_CLOSE': return 'Move your hand a little farther away';
    case 'NEAR_EDGE': return 'Move your hand toward the center';
    case 'TOO_DARK': return 'It is too dark — turn on a light';
    case 'KEEP_STILL': return 'Keep your hand still';
    case 'FACE_CAMERA': return 'Turn your palm toward the camera';
    case 'EXTEND_FINGER': return `Straighten your ${fingerName}`;
    case 'FOLD_FINGER': return `Fold your ${fingerName}`;
    case 'THUMB_UP': return 'Point your thumb upward';
    case 'THUMB_DOWN': return 'Point your thumb downward';
    case 'EXPECTED_GESTURES': return expected.includes('YES') && expected.includes('NO')
      ? 'Answer now: 👍 Yes or 👎 No'
      : `Show ${expected.map(gesture => t.gestures[gesture].label).join(' or ')} now`;
    default: return 'Show the gesture again';
  }
}
