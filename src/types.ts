export interface Lesson {
    UUID: string;
    Title: string;
    IsComplete: boolean;
  }
  
  export interface Chapter {
    UUID: string;
    Title: string;
    Lessons: Lesson[];
  }
  
  export interface CourseProgress {
    CourseUUID: string;
    Chapters: Chapter[];
  }