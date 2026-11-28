use std::time::{Duration, Instant};

pub struct OutputBatcher {
    max_delay: Duration,
    max_bytes: usize,
    buf: Vec<u8>,
    first_at: Option<Instant>,
    last_flush: Option<Instant>,
}

impl OutputBatcher {
    pub fn new(max_delay: Duration, max_bytes: usize) -> Self {
        Self {
            max_delay,
            max_bytes,
            buf: Vec::new(),
            first_at: None,
            last_flush: None,
        }
    }

    /// Buffers `bytes`; returns everything buffered once it reaches `max_bytes`
    /// or the oldest buffered byte is `max_delay` old. Output after a quiet spell of
    /// `max_delay` returns at once, so a keystroke's echo never waits on a timer.
    pub fn push(&mut self, bytes: &[u8], now: Instant) -> Option<Vec<u8>> {
        if bytes.is_empty() {
            return self.flush_due(now);
        }
        let quiet = self.buf.is_empty()
            && self
                .last_flush
                .is_none_or(|t| now.saturating_duration_since(t) >= self.max_delay);
        self.first_at.get_or_insert(now);
        self.buf.extend_from_slice(bytes);
        if quiet || self.buf.len() >= self.max_bytes {
            return self.flush_at(now);
        }
        self.flush_due(now)
    }

    pub fn flush_due(&mut self, now: Instant) -> Option<Vec<u8>> {
        match self.deadline() {
            Some(deadline) if now >= deadline => self.flush_at(now),
            _ => None,
        }
    }

    fn flush_at(&mut self, now: Instant) -> Option<Vec<u8>> {
        self.last_flush = Some(now);
        self.flush()
    }

    pub fn flush(&mut self) -> Option<Vec<u8>> {
        self.first_at = None;
        (!self.buf.is_empty()).then(|| std::mem::take(&mut self.buf))
    }

    /// When the buffered bytes become due, so a caller can sleep exactly that long.
    pub fn deadline(&self) -> Option<Instant> {
        self.first_at.map(|t| t + self.max_delay)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DELAY: Duration = Duration::from_millis(16);
    const MAX: usize = 64 * 1024;

    fn batcher() -> OutputBatcher {
        OutputBatcher::new(DELAY, MAX)
    }

    /// A batcher that flushed at the returned instant, so output arriving within `DELAY` is batched.
    fn busy() -> (OutputBatcher, Instant) {
        let mut b = batcher();
        let t0 = Instant::now();
        assert_eq!(b.push(b"x", t0), Some(b"x".to_vec()));
        (b, t0)
    }

    const MS: fn(u64) -> Duration = Duration::from_millis;

    #[test]
    fn first_output_after_a_quiet_spell_returns_at_once() {
        let mut b = batcher();
        let t0 = Instant::now();
        assert_eq!(b.push(b"a", t0), Some(b"a".to_vec()));
        assert_eq!(b.push(b"b", t0 + DELAY), Some(b"b".to_vec()));
        assert_eq!(b.deadline(), None);
    }

    #[test]
    fn push_below_both_limits_returns_none() {
        let (mut b, t0) = busy();
        assert_eq!(b.push(b"hello", t0 + MS(1)), None);
        assert_eq!(b.push(b" world", t0 + MS(5)), None);
    }

    #[test]
    fn flush_due_waits_for_the_delay_from_the_first_buffered_byte() {
        let (mut b, t0) = busy();
        b.push(b"ab", t0 + MS(1));
        b.push(b"cd", t0 + MS(10));
        assert_eq!(b.flush_due(t0 + MS(16)), None);
        assert_eq!(b.flush_due(t0 + MS(17)), Some(b"abcd".to_vec()));
        assert_eq!(b.flush_due(t0 + MS(100)), None);
    }

    #[test]
    fn push_after_the_delay_returns_the_buffer() {
        let (mut b, t0) = busy();
        b.push(b"ab", t0 + MS(1));
        assert_eq!(b.push(b"cd", t0 + MS(17)), Some(b"abcd".to_vec()));
    }

    #[test]
    fn push_crossing_max_bytes_returns_a_chunk() {
        let (mut b, t0) = busy();
        assert_eq!(b.push(&vec![1; MAX - 1], t0), None);
        let chunk = b.push(&[2, 3], t0).expect("chunk at 64 KiB");
        assert_eq!(chunk.len(), MAX + 1);
        assert_eq!(b.flush(), None);
    }

    #[test]
    fn deadline_is_first_byte_plus_delay_and_clears_on_flush() {
        let (mut b, t0) = busy();
        assert_eq!(b.deadline(), None);
        b.push(b"a", t0 + MS(1));
        b.push(b"b", t0 + MS(3));
        assert_eq!(b.deadline(), Some(t0 + MS(1) + DELAY));
        b.flush();
        assert_eq!(b.deadline(), None);
    }

    #[test]
    fn concatenated_chunks_equal_the_input_in_order() {
        let mut b = batcher();
        let t0 = Instant::now();
        let input: Vec<u8> = (0..200_000u32).map(|i| (i % 251) as u8).collect();
        let mut out = Vec::new();
        for (i, piece) in input.chunks(1000).enumerate() {
            let now = t0 + Duration::from_millis(i as u64);
            out.extend(b.flush_due(now).unwrap_or_default());
            out.extend(b.push(piece, now).unwrap_or_default());
        }
        out.extend(b.flush().unwrap_or_default());
        assert_eq!(out, input);
    }
}
