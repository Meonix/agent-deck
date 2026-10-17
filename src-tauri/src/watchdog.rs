use std::collections::HashMap;

use crate::diag::Level;

/// The sampler's period; health lines and the memory check use every `PER_MINUTE`th sample.
pub const SAMPLE_SECS: u64 = 10;
const PER_MINUTE: u32 = 6;
const CPU_HIGH: f64 = 90.0;
const CPU_HIGH_SAMPLES: u32 = 3;
const MEMORY_RISES: u32 = 10;
const MEMORY_GROWTH: f64 = 1.25;
const REPORT_MISMATCHES: u32 = 2;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ProcStat {
    pub rss_kb: u64,
    pub cpu: f64,
}

#[derive(Debug, Clone)]
pub struct PaneStat {
    pub pane: String,
    pub pid: u32,
    /// None when the process no longer shows up.
    pub stat: Option<ProcStat>,
}

#[derive(Debug, Clone)]
pub struct Sample {
    pub app: ProcStat,
    pub panes: Vec<PaneStat>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Note {
    pub level: Level,
    pub message: String,
}

/// What the UI holds, counted by the UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiReport {
    pub terminals: u32,
    pub expected_terminals: u32,
    pub title_timers: u32,
    pub live_panes: u32,
}

#[derive(Default)]
pub struct Watchdog {
    samples: u32,
    recent_cpu: Vec<f64>,
    cpu_warned: bool,
    last_rss: Option<u64>,
    rise_base: u64,
    rises: u32,
    memory_warned: bool,
    mismatches: u32,
}

impl Watchdog {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn observe(&mut self, sample: &Sample) -> Vec<Note> {
        let mut notes = Vec::new();
        self.samples += 1;
        notes.extend(self.check_cpu(sample.app.cpu));
        if self.samples.is_multiple_of(PER_MINUTE) {
            notes.push(health(sample));
            notes.extend(self.check_memory(sample.app.rss_kb));
        }
        notes
    }

    fn check_cpu(&mut self, cpu: f64) -> Option<Note> {
        if cpu <= CPU_HIGH {
            self.recent_cpu.clear();
            self.cpu_warned = false;
            return None;
        }
        self.recent_cpu.push(cpu);
        if self.cpu_warned || self.recent_cpu.len() < CPU_HIGH_SAMPLES as usize {
            return None;
        }
        self.cpu_warned = true;
        let figures: Vec<String> = self.recent_cpu.iter().map(|c| format!("{c:.1}%")).collect();
        self.recent_cpu.clear();
        Some(warn(format!(
            "app CPU above 90% for {} s ({}): busy loop?",
            CPU_HIGH_SAMPLES as u64 * SAMPLE_SECS,
            figures.join(", ")
        )))
    }

    fn check_memory(&mut self, rss_kb: u64) -> Option<Note> {
        let rising = self.last_rss.is_some_and(|last| rss_kb > last);
        self.last_rss = Some(rss_kb);
        if !rising {
            self.rise_base = rss_kb;
            self.rises = 0;
            self.memory_warned = false;
            return None;
        }
        self.rises += 1;
        let grown = rss_kb as f64 >= self.rise_base as f64 * MEMORY_GROWTH;
        if self.memory_warned || self.rises < MEMORY_RISES || !grown {
            return None;
        }
        self.memory_warned = true;
        Some(warn(format!(
            "app memory grew {} minutes in a row, {} to {}: leak?",
            self.rises,
            mb(self.rise_base),
            mb(rss_kb)
        )))
    }

    pub fn report(&mut self, report: &UiReport) -> Vec<Note> {
        let matches = report.terminals == report.expected_terminals
            && report.title_timers == report.live_panes;
        if matches {
            self.mismatches = 0;
            return Vec::new();
        }
        self.mismatches += 1;
        if self.mismatches != REPORT_MISMATCHES {
            return Vec::new();
        }
        vec![warn(format!(
            "UI holds {} terminals for {} panes and {} title timers for {} live panes",
            report.terminals, report.expected_terminals, report.title_timers, report.live_panes
        ))]
    }
}

fn health(sample: &Sample) -> Note {
    let panes: Vec<String> = sample
        .panes
        .iter()
        .map(|p| match p.stat {
            Some(s) => format!(
                "{} pid={} rss={} cpu={:.1}%",
                short(&p.pane),
                p.pid,
                mb(s.rss_kb),
                s.cpu
            ),
            None => format!("{} pid={} gone", short(&p.pane), p.pid),
        })
        .collect();
    let mut message = format!(
        "health: app rss={} cpu={:.1}% panes={}",
        mb(sample.app.rss_kb),
        sample.app.cpu,
        sample.panes.len()
    );
    if !panes.is_empty() {
        message.push_str(" | ");
        message.push_str(&panes.join("; "));
    }
    Note {
        level: Level::Info,
        message,
    }
}

pub fn survivor(pane: &str, pid: u32) -> Note {
    warn(format!(
        "process {pid} of pane {} still running 5 s after its pane closed",
        short(pane)
    ))
}

/// `ps -o pid=,rss=,%cpu=` output by pid.
pub fn parse_ps(output: &str) -> HashMap<u32, ProcStat> {
    output
        .lines()
        .filter_map(|line| {
            let mut fields = line.split_whitespace();
            let pid = fields.next()?.parse().ok()?;
            let rss_kb = fields.next()?.parse().ok()?;
            // Some locales print the CPU share with a decimal comma.
            let cpu = fields.next()?.replace(',', ".").parse().ok()?;
            Some((pid, ProcStat { rss_kb, cpu }))
        })
        .collect()
}

fn warn(message: String) -> Note {
    Note {
        level: Level::Warn,
        message,
    }
}

fn mb(kb: u64) -> String {
    format!("{:.1}MB", kb as f64 / 1024.0)
}

fn short(pane: &str) -> &str {
    pane.get(..8).unwrap_or(pane)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn app(rss_mb: u64, cpu: f64) -> Sample {
        Sample {
            app: ProcStat {
                rss_kb: rss_mb * 1024,
                cpu,
            },
            panes: vec![],
        }
    }

    fn warnings(notes: &[Note]) -> Vec<&str> {
        notes
            .iter()
            .filter(|n| n.level == Level::Warn)
            .map(|n| n.message.as_str())
            .collect()
    }

    #[test]
    fn warns_once_when_cpu_stays_high_for_30_seconds_and_again_after_it_drops() {
        let mut w = Watchdog::new();
        let cpus = [95.0, 97.0, 99.0, 98.0, 40.0, 95.0, 96.0, 97.0];
        let warned: Vec<usize> = cpus
            .iter()
            .enumerate()
            .filter(|(_, cpu)| !warnings(&w.observe(&app(100, **cpu))).is_empty())
            .map(|(i, _)| i)
            .collect();
        assert_eq!(warned, vec![2, 7]);
    }

    #[test]
    fn a_short_cpu_spike_is_not_a_loop() {
        let mut w = Watchdog::new();
        for cpu in [95.0, 99.0, 20.0, 95.0, 99.0, 20.0] {
            assert!(warnings(&w.observe(&app(100, cpu))).is_empty());
        }
    }

    #[test]
    fn the_cpu_warning_names_the_figures() {
        let mut w = Watchdog::new();
        let notes: Vec<Note> = [95.0, 97.0, 99.5]
            .iter()
            .flat_map(|cpu| w.observe(&app(100, *cpu)))
            .collect();
        assert_eq!(
            warnings(&notes),
            vec!["app CPU above 90% for 30 s (95.0%, 97.0%, 99.5%): busy loop?"]
        );
    }

    #[test]
    fn writes_a_health_line_every_minute_with_each_pane() {
        let mut w = Watchdog::new();
        let sample = Sample {
            app: ProcStat {
                rss_kb: 150 * 1024,
                cpu: 3.25,
            },
            panes: vec![
                PaneStat {
                    pane: "a1b2c3d4-0000-0000-0000-000000000000".into(),
                    pid: 4242,
                    stat: Some(ProcStat {
                        rss_kb: 80 * 1024,
                        cpu: 0.5,
                    }),
                },
                PaneStat {
                    pane: "ffffffff-0000-0000-0000-000000000000".into(),
                    pid: 4343,
                    stat: None,
                },
            ],
        };
        let infos: Vec<(usize, String)> = (0..12)
            .flat_map(|i| {
                w.observe(&sample)
                    .into_iter()
                    .filter(|n| n.level == Level::Info)
                    .map(move |n| (i, n.message))
            })
            .collect();
        let expected = "health: app rss=150.0MB cpu=3.2% panes=2 | a1b2c3d4 pid=4242 rss=80.0MB cpu=0.5%; ffffffff pid=4343 gone".to_string();
        assert_eq!(infos, vec![(5, expected.clone()), (11, expected)]);
    }

    /// One minute: the memory check only looks at every sixth sample.
    fn minute(w: &mut Watchdog, rss_mb: u64) -> Vec<Note> {
        (0..PER_MINUTE)
            .flat_map(|_| w.observe(&app(rss_mb, 1.0)))
            .collect()
    }

    #[test]
    fn warns_once_when_memory_grows_ten_minutes_in_a_row_by_a_quarter() {
        let mut w = Watchdog::new();
        let mut warned = vec![];
        for (i, rss) in (100..=145).step_by(3).enumerate() {
            if !warnings(&minute(&mut w, rss)).is_empty() {
                warned.push((i, rss));
            }
        }
        // 100 is the base; the tenth rise reaches 130 ≥ 125.
        assert_eq!(warned, vec![(10, 130)]);
    }

    #[test]
    fn slow_or_interrupted_growth_is_not_a_leak() {
        let mut w = Watchdog::new();
        for rss in 100..115 {
            assert!(warnings(&minute(&mut w, rss)).is_empty());
        }
        let mut w = Watchdog::new();
        for rss in [100, 110, 120, 130, 130, 140, 150, 160, 170, 180, 190, 200] {
            assert!(warnings(&minute(&mut w, rss)).is_empty(), "{rss}");
        }
    }

    #[test]
    fn warns_when_the_ui_report_mismatches_twice_in_a_row() {
        let mut w = Watchdog::new();
        let fine = UiReport {
            terminals: 2,
            expected_terminals: 2,
            title_timers: 1,
            live_panes: 1,
        };
        let leaked_terminal = UiReport {
            terminals: 3,
            ..fine
        };
        let leaked_timer = UiReport {
            title_timers: 2,
            ..fine
        };
        assert!(warnings(&w.report(&leaked_terminal)).is_empty());
        assert!(warnings(&w.report(&fine)).is_empty());
        assert!(warnings(&w.report(&leaked_terminal)).is_empty());
        assert_eq!(
            warnings(&w.report(&leaked_timer)),
            vec!["UI holds 2 terminals for 2 panes and 2 title timers for 1 live panes"]
        );
        assert!(
            warnings(&w.report(&leaked_timer)).is_empty(),
            "once per streak"
        );
    }

    #[test]
    fn survivor_names_pane_and_pid() {
        assert_eq!(
            survivor("a1b2c3d4-0000", 4242),
            Note {
                level: Level::Warn,
                message: "process 4242 of pane a1b2c3d4 still running 5 s after its pane closed"
                    .into()
            }
        );
    }

    #[test]
    fn parse_ps_reads_pid_rss_and_cpu() {
        let map = parse_ps("  123  4567   1.5\n 456 100 0,0\n\nbad line\n");
        assert_eq!(
            map.get(&123),
            Some(&ProcStat {
                rss_kb: 4567,
                cpu: 1.5
            })
        );
        assert_eq!(
            map.get(&456),
            Some(&ProcStat {
                rss_kb: 100,
                cpu: 0.0
            })
        );
        assert_eq!(map.len(), 2);
    }
}
