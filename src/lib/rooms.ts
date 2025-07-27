import { supabase } from './supabaseClient';

export type Room = {
  id: string;
  room_code: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  end_time: string | null;
  is_ready: boolean;
  is_private: boolean;
  join_locked: boolean;
  course_id: string | null;
  course_name: string | null;
  admin_id: string;
};

export type PlayerRow = {
  player_id: string;
  battle_room_id: string;
  player_progress: any;
  last_progress_at: string | null;
  score: number;
  display_name: string | null;
};

export type MemberWithEmail = PlayerRow & { email?: string | null };

export type ChatMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

async function getUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('Not signed in');
  return user.id;
}

export async function createRoomForCourse(
  courseId: string | null,
  courseName: string | null,
  isPrivate = true,
  displayName?: string
): Promise<Room> {
  const uid = await getUserId();

  const { data, error } = await supabase
    .from('battle_rooms')
    .insert({
      admin_id: uid,
      course_id: courseId,
      course_name: courseName,
      is_private: isPrivate,
    })
    .select('*')
    .single();
  if (error) throw error;

  const { error: pErr } = await supabase.from('battle_players').insert({
    player_id: uid,
    battle_room_id: data.id,
    player_progress: {},
    display_name: displayName ?? null
  });
  if (pErr && pErr.code !== '23505') throw pErr;

  return data as Room;
}


export async function joinRoomByCode(code: string, displayName: string): Promise<Room> {
  const uid  = await getUserId();
  const clean = code.trim().toUpperCase();

  const { data: room, error } = await supabase
    .from('battle_rooms')
    .select('*')
    .eq('room_code', clean)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!room) throw new Error('Invalid code or room is hidden.');
  if (room.join_locked || room.finished_at) throw new Error('This room is closed to new players.');

  const { error: pErr } = await supabase
    .from('battle_players')
    .insert({
      player_id: uid,
      battle_room_id: room.id,
      player_progress: {},
      display_name: displayName
    });
  if (pErr && pErr.code !== '23505') throw pErr;

  if (pErr && pErr.code === '23505') {
    await supabase
      .from('battle_players')
      .update({ display_name: displayName })
      .eq('player_id', uid)
      .eq('battle_room_id', room.id);
  }

  return room as Room;
}

export async function updateDisplayName(roomId: string, name: string): Promise<void> {
  const uid = await getUserId();
  const { error } = await supabase
    .from('battle_players')
    .update({ display_name: name })
    .eq('player_id', uid)
    .eq('battle_room_id', roomId);
  if (error) throw error;
}


export async function getMyRooms(): Promise<Room[]> {
  const uid = await getUserId();

  const [{ data: adminRooms, error: e1 }, { data: playerRows, error: e2 }] = await Promise.all([
    supabase.from('battle_rooms').select('*').eq('admin_id', uid),
    supabase.from('battle_players').select('battle_room_id').eq('player_id', uid),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const roomIds = new Set(playerRows?.map(r => r.battle_room_id) ?? []);
  const { data: memberRooms, error: e3 } = roomIds.size
    ? await supabase.from('battle_rooms').select('*').in('id', Array.from(roomIds))
    : { data: [], error: null };

  if (e3) throw e3;

  const map = new Map<string, Room>();
  (adminRooms ?? []).forEach(r => map.set(r.id, r as Room));
  (memberRooms ?? []).forEach(r => map.set(r.id, r as Room));
  return Array.from(map.values())
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function startRoom(roomId: string): Promise<Room> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('battle_rooms')
    .update({ started_at: now, join_locked: true, is_ready: true })
    .eq('id', roomId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Room;
}

export async function finishRoom(roomId: string): Promise<{ room: Room; winnerId: string | null }> {
  const { data: players, error: pErr } = await supabase
    .from('battle_players')
    .select('*')
    .eq('battle_room_id', roomId);
  if (pErr) throw pErr;

  let winnerId: string | null = null;
  if (players?.length) {
    players.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    winnerId = players[0]?.player_id ?? null;
  }

  const now = new Date().toISOString();
  const { data: room, error: rErr } = await supabase
    .from('battle_rooms')
    .update({ finished_at: now })
    .eq('id', roomId)
    .select('*')
    .single();
  if (rErr) throw rErr;

  if (players?.length) {
    if (winnerId) await nonAtomicIncWin(winnerId);
    const losers = players.filter(p => p.player_id !== winnerId).map(p => p.player_id);
    await Promise.all(losers.map(nonAtomicIncLoss));
  }

  return { room: room as Room, winnerId };
}

export async function deleteRoom(roomId: string): Promise<void> {
  const { error } = await supabase.from('battle_rooms').delete().eq('id', roomId);
  if (error) throw error;
}

export async function upsertPlayerProgress(
  roomId: string,
  progress: any,
  score: number
): Promise<PlayerRow> {
  const uid = await getUserId();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('battle_players')
    .upsert(
      {
        player_id: uid,
        battle_room_id: roomId,
        player_progress: progress,
        score,
        last_progress_at: now,
      },
      { onConflict: 'player_id,battle_room_id' }
    )
    .select('*')
    .single();
  if (error) throw error;
  return data as PlayerRow;
}


export async function getRoomMembers(roomId: string): Promise<PlayerRow[]> {
  const { data, error } = await supabase
    .from('battle_players')
    .select('*')
    .eq('battle_room_id', roomId);
  if (error) throw error;
  return data as PlayerRow[];
}


export async function sendChatMessage(roomId: string, content: string): Promise<ChatMessage> {
    const uid = await getUserId(); 
    const { data, error } = await supabase
      .from('battle_messages')
      .insert({ room_id: roomId, sender_id: uid, content })
      .select('*')
      .single();
    if (error) throw error;
    return data as ChatMessage;
  }
  

export async function getChatHistory(roomId: string, limit = 100): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('battle_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data as ChatMessage[];
}

export function subscribeChat(roomId: string, onInsert: (msg: ChatMessage) => void): () => void {
  const channel = supabase
    .channel(`chat:${roomId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'battle_messages', filter: `room_id=eq.${roomId}` },
      payload => onInsert(payload.new as ChatMessage)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function subscribeRoom(
  roomId: string,
  onRoomChange: (payload: any) => void,
  onPlayersChange: (payload: any) => void
): () => void {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'battle_rooms', filter: `id=eq.${roomId}` },
      payload => onRoomChange(payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'battle_players', filter: `battle_room_id=eq.${roomId}` },
      payload => onPlayersChange(payload)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function subscribeRooms(onChange: () => void): () => void {
  const channel = supabase
    .channel('rooms-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_rooms' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_players' }, onChange)
    .subscribe();

  return () => supabase.removeChannel(channel);
}

async function nonAtomicIncWin(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('wins')
    .eq('id', userId)
    .single();
  if (error) { console.warn('wins select err', error.message); return; }

  const current = data?.wins ?? 0;
  const { error: uErr } = await supabase
    .from('profiles')
    .update({ wins: current + 1 })
    .eq('id', userId);
  if (uErr) console.warn('wins update err', uErr.message);
}

async function nonAtomicIncLoss(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('losses')
    .eq('id', userId)
    .single();
  if (error) { console.warn('losses select err', error.message); return; }

  const current = data?.losses ?? 0;
  const { error: uErr } = await supabase
    .from('profiles')
    .update({ losses: current + 1 })
    .eq('id', userId);
  if (uErr) console.warn('losses update err', uErr.message);
}
