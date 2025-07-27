import type { CourseProgress, Chapter, Lesson } from '../types';

import { getBootDevToken } from './bootdevToken';

export async function fetchCourseProgressByLesson(lessonId: string): Promise<CourseProgress> {
  const token = await getBootDevToken();
  const apiUrl = `https://api.boot.dev/v1/course_progress_by_lesson/${lessonId}`;

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(apiUrl, {
    headers,
    credentials: 'include',
  });

  if (!res.ok) throw new Error(`Boot.dev API ${res.status}`);
  return res.json();
}

export function toSnapshot(progress: CourseProgress) {
  let total = 0;
  let done = 0;

  const chapters = progress.Chapters.map((c: Chapter) => {
    const cTotal = c.Lessons.length;
    const cDone = c.Lessons.reduce((acc: number, l: Lesson) => acc + (l.IsComplete ? 1 : 0), 0);
    total += cTotal;
    done += cDone;
    return {
      title: c.Title,
      total: cTotal,
      done: cDone,
    };
  });

  return {
    courseUUID: progress.CourseUUID,
    total,
    done,
    chapters,
  };
}

export function calcScore(snapshot: { total: number; done: number }): number {
  if (!snapshot.total) return 0;
  return Math.round((snapshot.done / snapshot.total) * 100);
}

export async function buildProgressSnapshot(lessonId: string) {
  const raw = await fetchCourseProgressByLesson(lessonId);
  const snap = toSnapshot(raw);
  const score = calcScore(snap);
  return { snapshot: snap, score };
}
