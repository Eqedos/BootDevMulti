import type { CourseProgress, Chapter, Lesson } from "./types"

async function fetchAndLogProgress(lessonId: string): Promise<void> {
  const apiUrl = `https://api.boot.dev/v1/course_progress_by_lesson/${lessonId}`;
  
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }
    const data: CourseProgress = await response.json();

    console.log(`--- Progress for Course: ${data.CourseUUID} ---`);
    data.Chapters.forEach((chapter: Chapter) => {
      console.log(`\nChapter: ${chapter.Title}`);
      chapter.Lessons.forEach((lesson: Lesson) => {
        const status = lesson.IsComplete ? '✅ Complete' : '❌ Incomplete';
        console.log(`  - ${lesson.Title}: ${status}`);
      });
    });

  } catch (error) {
    console.error("Failed to fetch or process lesson progress:", error);
  }
}

export function initLessonFeatures(): void {
  console.log("Lesson features initializing...");
  const pathParts = window.location.pathname.split('/');
  const lessonId = pathParts.pop() || pathParts.pop();

  if (lessonId) {
    fetchAndLogProgress(lessonId);
  } else {
    console.error("Could not extract lesson ID from URL.");
  }
}