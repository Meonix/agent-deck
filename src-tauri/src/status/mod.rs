//! Session status: hook events mapped to signals, and the state machine they drive.

pub mod machine;
pub mod signal;

pub use machine::{Signal, State, StatusChange, StatusMachine};
pub use signal::{ApprovalKey, HookSignal, signal_of};
