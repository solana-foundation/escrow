//! # Escrow Program
//!
//! A Solana program for managing token escrows with optional timelocks,
//! hooks, and mint allowlists.
//!
//! ## Features
//! - Mint allowlisting per escrow
//! - Optional withdrawal timelock
//! - Custom pre/post hooks for deposit/withdraw
//! - Token-2022 extension blocking
//!
//! ## Architecture
//! Built with Pinocchio (no_std). Clients auto-generated via Codama.

#![no_std]

extern crate alloc;

use pinocchio::address::declare_id;

pub mod errors;
pub mod traits;
pub mod utils;

pub mod events;
pub mod instructions;
pub mod state;

#[cfg(not(feature = "no-entrypoint"))]
pub mod entrypoint;

declare_id!("Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg");

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "Escrow Program",
    project_url: "https://github.com/solana-foundation/escrow",
    contacts: "link:https://github.com/solana-foundation/escrow/security/advisories/new",
    policy: "https://github.com/solana-foundation/escrow/security/policy",
    source_code: "https://github.com/solana-foundation/escrow"
}
