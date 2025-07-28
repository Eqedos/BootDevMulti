-- schema for reference

CREATE TABLE public.battle_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT battle_messages_pkey PRIMARY KEY (id),
  CONSTRAINT battle_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.battle_rooms(id),
  CONSTRAINT battle_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id)
);
CREATE TABLE public.battle_players (
  player_id uuid NOT NULL,
  battle_room_id uuid NOT NULL,
  player_progress jsonb,
  last_progress_at timestamp with time zone DEFAULT now(),
  score integer DEFAULT 0,
  display_name text,
  CONSTRAINT battle_players_pkey PRIMARY KEY (player_id, battle_room_id),
  CONSTRAINT battle_players_battle_room_id_fkey FOREIGN KEY (battle_room_id) REFERENCES public.battle_rooms(id),
  CONSTRAINT battle_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES auth.users(id)
);
CREATE TABLE public.battle_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_code text NOT NULL DEFAULT generate_room_code() UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  end_time timestamp with time zone,
  is_ready boolean DEFAULT false,
  is_private boolean DEFAULT true,
  course_id text,
  course_name text,
  admin_id uuid NOT NULL,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  join_locked boolean NOT NULL DEFAULT false,
  CONSTRAINT battle_rooms_pkey PRIMARY KEY (id),
  CONSTRAINT battle_rooms_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  username text,
  rank text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);