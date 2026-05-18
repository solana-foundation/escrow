use alloc::vec;
use alloc::vec::Vec;
use codama::CodamaAccount;
use pinocchio::{account::AccountView, cpi::Seed, error::ProgramError, Address, ProgramResult, Resize};

use crate::state::extensions::TimelockData;
use crate::traits::{AccountSerialize, Discriminator, EscrowAccountDiscriminators, PdaSeeds, Versioned};
use crate::utils::{create_pda_account_idempotent, resize_pda_account, TlvReader};
use crate::{assert_no_padding, require_len, validate_discriminator};

/// Extension type discriminators for TLV-encoded extension data
#[repr(u16)]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum ExtensionType {
    Timelock = 0,
    Hook = 1,
    BlockedTokenExtensions = 2,
    Arbiter = 3,
}

impl TryFrom<u16> for ExtensionType {
    type Error = ProgramError;

    fn try_from(value: u16) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Self::Timelock),
            1 => Ok(Self::Hook),
            2 => Ok(Self::BlockedTokenExtensions),
            3 => Ok(Self::Arbiter),
            _ => Err(ProgramError::InvalidAccountData),
        }
    }
}

/// TLV header size: type (u16) + length (u16)
pub const TLV_HEADER_SIZE: usize = 4;

/// Escrow extensions header (fixed size, stored at start of account)
///
/// # PDA Seeds
/// `[b"extensions", escrow.as_ref()]`
///
/// # Account Layout
/// ```text
/// [discriminator: 1][version: 1][header: 2][TLV extensions: variable]
/// ```
#[derive(Clone, Debug, PartialEq, CodamaAccount)]
#[codama(field("discriminator", number(u8), default_value = 2))]
#[codama(discriminator(field = "discriminator"))]
#[codama(pda = "extensions")]
#[codama(seed(type = string(utf8), value = "extensions"))]
#[codama(seed(name = "escrow", type = public_key))]
#[repr(C)]
pub struct EscrowExtensionsHeader {
    pub bump: u8,
    pub extension_count: u8,
}

assert_no_padding!(EscrowExtensionsHeader, 1 + 1);

impl Discriminator for EscrowExtensionsHeader {
    const DISCRIMINATOR: u8 = EscrowAccountDiscriminators::EscrowExtensionsDiscriminator as u8;
}

impl Versioned for EscrowExtensionsHeader {
    const VERSION: u8 = 1;
}

impl AccountSerialize for EscrowExtensionsHeader {
    fn to_bytes_inner(&self) -> Vec<u8> {
        vec![self.bump, self.extension_count]
    }
}

impl EscrowExtensionsHeader {
    pub const DATA_LEN: usize = 1 + 1; // bump + extension_count
    pub const LEN: usize = 1 + 1 + Self::DATA_LEN; // discriminator + version + data

    pub fn new(bump: u8, extension_count: u8) -> Self {
        Self { bump, extension_count }
    }

    /// Parse header from account data (validates discriminator, skips version)
    pub fn from_bytes(data: &[u8]) -> Result<Self, ProgramError> {
        require_len!(data, Self::LEN);

        validate_discriminator!(data, Self::DISCRIMINATOR);
        if data[1] != Self::VERSION {
            return Err(ProgramError::InvalidAccountData);
        }

        // Skip discriminator (byte 0) and version (byte 1)
        Ok(Self { bump: data[2], extension_count: data[3] })
    }

    /// Get the byte offset where TLV data starts
    pub const fn tlv_offset() -> usize {
        Self::LEN
    }
}

/// PDA context for extensions - holds escrow address for seed derivation
///
/// Implements `PdaSeeds` trait for consistent PDA handling across codebase.
pub struct ExtensionsPda<'a> {
    pub escrow: &'a Address,
}

impl<'a> ExtensionsPda<'a> {
    pub fn new(escrow: &'a Address) -> Self {
        Self { escrow }
    }
}

impl PdaSeeds for ExtensionsPda<'_> {
    const PREFIX: &'static [u8] = b"extensions";

    fn seeds(&self) -> Vec<&[u8]> {
        vec![Self::PREFIX, self.escrow.as_ref()]
    }

    fn seeds_with_bump<'a>(&'a self, bump: &'a [u8; 1]) -> Vec<Seed<'a>> {
        vec![Seed::from(Self::PREFIX), Seed::from(self.escrow.as_ref()), Seed::from(bump.as_slice())]
    }
}

/// Calculate total account size for extensions PDA
pub fn calculate_extensions_account_size(has_timelock: bool) -> usize {
    let mut size = EscrowExtensionsHeader::LEN;
    if has_timelock {
        size += TLV_HEADER_SIZE + TimelockData::LEN;
    }
    size
}

/// Appends a TLV extension to the extensions PDA.
///
/// Creates account if new, or resizes if existing (via `create_pda_account_idempotent`).
/// Returns error if the extension type already exists (no duplicates allowed).
pub fn append_extension<const N: usize>(
    payer: &AccountView,
    extensions: &AccountView,
    program_id: &Address,
    bump: u8,
    ext_type: ExtensionType,
    new_tlv: &[u8],
    pda_signer_seeds: [Seed; N],
) -> ProgramResult {
    // 1. Read current data (if any)
    let current_data_len = extensions.data_len();
    let (extension_count, existing_tlv) = if current_data_len > 0 {
        let data = extensions.try_borrow()?;
        let header = EscrowExtensionsHeader::from_bytes(&data)?;

        // Check for duplicate extension
        let reader = TlvReader::new(&data);
        if reader.find_extension(ext_type)?.is_some() {
            return Err(ProgramError::AccountAlreadyInitialized);
        }

        let tlv_slice = data[EscrowExtensionsHeader::LEN..].to_vec();
        (header.extension_count, tlv_slice)
    } else {
        (0, Vec::new())
    };

    // 2. Build new data: existing TLV + new TLV
    let mut all_tlv = existing_tlv;
    all_tlv.extend_from_slice(new_tlv);

    // 3. Calculate required size
    let required_size = EscrowExtensionsHeader::LEN + all_tlv.len();

    // 4. Create/resize account
    create_pda_account_idempotent(payer, required_size, program_id, extensions, pda_signer_seeds)?;

    // 5. Write data
    let mut extensions = *extensions;
    let mut data = extensions.try_borrow_mut()?;
    let new_header = EscrowExtensionsHeader::new(bump, extension_count + 1);
    let header_bytes = new_header.to_bytes();
    data[..EscrowExtensionsHeader::LEN].copy_from_slice(&header_bytes);
    data[EscrowExtensionsHeader::LEN..required_size].copy_from_slice(&all_tlv);

    Ok(())
}

/// Updates an existing TLV extension entry in the extensions PDA.
///
/// Finds the extension by type, replaces its data, and resizes account if needed.
/// Returns error if the extension type doesn't exist.
pub fn update_extension(
    payer: &AccountView,
    extensions: &AccountView,
    ext_type: ExtensionType,
    new_tlv: &[u8],
) -> ProgramResult {
    let current_data_len = extensions.data_len();
    if current_data_len == 0 {
        return Err(ProgramError::UninitializedAccount);
    }

    let data = extensions.try_borrow()?;
    let header = EscrowExtensionsHeader::from_bytes(&data)?;

    // Find the extension entry
    let mut offset = EscrowExtensionsHeader::LEN;
    let mut found_offset = None;
    let mut old_tlv_len = 0;

    while offset + TLV_HEADER_SIZE <= data.len() {
        let type_bytes = u16::from_le_bytes([data[offset], data[offset + 1]]);
        let length = u16::from_le_bytes([data[offset + 2], data[offset + 3]]) as usize;

        if offset + TLV_HEADER_SIZE + length > data.len() {
            break;
        }

        if type_bytes == ext_type as u16 {
            found_offset = Some(offset);
            old_tlv_len = TLV_HEADER_SIZE + length;
            break;
        }

        offset += TLV_HEADER_SIZE + length;
    }

    let found_offset = found_offset.ok_or(ProgramError::UninitializedAccount)?;

    // Build new TLV data: before + new entry + after
    let before = data[EscrowExtensionsHeader::LEN..found_offset].to_vec();
    let after_start = found_offset + old_tlv_len;
    let after = data[after_start..].to_vec();
    let header_bytes = header.to_bytes();

    drop(data);

    let mut new_tlv_data = Vec::new();
    new_tlv_data.extend_from_slice(&before);
    new_tlv_data.extend_from_slice(&(ext_type as u16).to_le_bytes());
    new_tlv_data.extend_from_slice(&(new_tlv.len() as u16).to_le_bytes());
    new_tlv_data.extend_from_slice(new_tlv);
    new_tlv_data.extend_from_slice(&after);

    // Calculate required size
    let required_size = EscrowExtensionsHeader::LEN + new_tlv_data.len();

    // Resize to exact length (handles growth rent top-up and shrink truncation).
    resize_pda_account(payer, extensions, required_size)?;

    // Write data
    let mut extensions = *extensions;
    let mut data = extensions.try_borrow_mut()?;
    data[..EscrowExtensionsHeader::LEN].copy_from_slice(&header_bytes);
    data[EscrowExtensionsHeader::LEN..required_size].copy_from_slice(&new_tlv_data);

    Ok(())
}

/// Removes an existing TLV extension entry from the extensions PDA.
///
/// Finds the extension by type, removes it from TLV data, decrements extension count,
/// and shrinks the account data size accordingly.
/// Returns error if the extension type doesn't exist.
pub fn remove_extension(extensions: &AccountView, ext_type: ExtensionType) -> ProgramResult {
    let current_data_len = extensions.data_len();
    if current_data_len == 0 {
        return Err(ProgramError::UninitializedAccount);
    }

    let data = extensions.try_borrow()?;
    let header = EscrowExtensionsHeader::from_bytes(&data)?;

    if header.extension_count == 0 {
        return Err(ProgramError::UninitializedAccount);
    }

    // Find the extension entry.
    let mut offset = EscrowExtensionsHeader::LEN;
    let mut found_offset = None;
    let mut removed_tlv_len = 0;

    while offset + TLV_HEADER_SIZE <= data.len() {
        let type_bytes = u16::from_le_bytes([data[offset], data[offset + 1]]);
        let length = u16::from_le_bytes([data[offset + 2], data[offset + 3]]) as usize;

        if offset + TLV_HEADER_SIZE + length > data.len() {
            break;
        }

        if type_bytes == ext_type as u16 {
            found_offset = Some(offset);
            removed_tlv_len = TLV_HEADER_SIZE + length;
            break;
        }

        offset += TLV_HEADER_SIZE + length;
    }

    let found_offset = found_offset.ok_or(ProgramError::UninitializedAccount)?;
    let new_extension_count = header.extension_count.checked_sub(1).ok_or(ProgramError::InvalidAccountData)?;

    // Build new TLV data without the removed extension.
    let before = data[EscrowExtensionsHeader::LEN..found_offset].to_vec();
    let after_start = found_offset + removed_tlv_len;
    let after = data[after_start..].to_vec();
    let mut new_tlv_data = Vec::with_capacity(before.len() + after.len());
    new_tlv_data.extend_from_slice(&before);
    new_tlv_data.extend_from_slice(&after);

    drop(data);

    let required_size = EscrowExtensionsHeader::LEN + new_tlv_data.len();

    // Shrink the account to reclaim unused data bytes.
    let mut extensions = *extensions;
    extensions.resize(required_size)?;

    // Write updated header and TLV bytes.
    let mut data = extensions.try_borrow_mut()?;
    let new_header = EscrowExtensionsHeader::new(header.bump, new_extension_count);
    let header_bytes = new_header.to_bytes();
    data[..EscrowExtensionsHeader::LEN].copy_from_slice(&header_bytes);
    if !new_tlv_data.is_empty() {
        data[EscrowExtensionsHeader::LEN..required_size].copy_from_slice(&new_tlv_data);
    }

    Ok(())
}

/// Updates or appends a TLV extension to the extensions PDA.
///
/// Simplifies the common pattern of checking if extension exists and either updating or appending:
/// - If no data exists → creates account with new extension
/// - If data exists but extension not found → appends new extension
/// - If data exists and extension found → updates existing extension
///
/// Note: `ext_data` should be the raw extension data (not TLV-wrapped). This function
/// handles TLV wrapping internally for append operations.
pub fn update_or_append_extension<const N: usize>(
    payer: &AccountView,
    extensions: &AccountView,
    program_id: &Address,
    bump: u8,
    ext_type: ExtensionType,
    ext_data: &[u8],
    pda_signer_seeds: [Seed; N],
) -> ProgramResult {
    // Build TLV-wrapped data for append operations
    let build_tlv = || {
        let mut tlv = Vec::with_capacity(TLV_HEADER_SIZE + ext_data.len());
        tlv.extend_from_slice(&(ext_type as u16).to_le_bytes());
        tlv.extend_from_slice(&(ext_data.len() as u16).to_le_bytes());
        tlv.extend_from_slice(ext_data);
        tlv
    };

    if extensions.data_len() == 0 {
        let tlv = build_tlv();
        append_extension(payer, extensions, program_id, bump, ext_type, &tlv, pda_signer_seeds)
    } else {
        let data = extensions.try_borrow()?;
        let reader = TlvReader::new(&data);
        let extension_exists = reader.find_extension(ext_type)?.is_some();
        drop(data);

        if extension_exists {
            update_extension(payer, extensions, ext_type, ext_data)
        } else {
            let tlv = build_tlv();
            append_extension(payer, extensions, program_id, bump, ext_type, &tlv, pda_signer_seeds)
        }
    }
}

/// Validates the extensions PDA address and bump.
///
/// Returns `Ok(())` if:
/// - Extensions account is the correct PDA for this escrow
/// - If data exists, the stored bump matches the derived address
pub fn validate_extensions_pda(escrow: &AccountView, extensions: &AccountView, program_id: &Address) -> ProgramResult {
    if extensions.data_len() > 0 {
        if !extensions.owned_by(program_id) {
            return Err(ProgramError::InvalidAccountOwner);
        }

        let data = extensions.try_borrow()?;
        let header = EscrowExtensionsHeader::from_bytes(&data)?;

        let derived =
            Address::derive_address(&[ExtensionsPda::PREFIX, escrow.address().as_ref()], Some(header.bump), program_id);
        if extensions.address() != &derived {
            return Err(ProgramError::InvalidSeeds);
        }
    } else {
        // Extensions account not yet created — derive canonical bump via find_program_address
        let extensions_pda = ExtensionsPda::new(escrow.address());
        extensions_pda.validate_pda_address(extensions, program_id)?;
    }

    Ok(())
}

/// Gets extension data for requested types from an extensions account.
///
/// Handles empty/uninitialized accounts by returning all `None` values.
/// Returns `Vec<Option<Vec<u8>>>` in same order as `to_get`.
pub fn get_extensions_from_account(
    extensions: &AccountView,
    to_get: &[ExtensionType],
) -> Result<Vec<Option<Vec<u8>>>, ProgramError> {
    let mut results = vec![None; to_get.len()];

    if extensions.data_len() == 0 {
        return Ok(results);
    }

    let data = extensions.try_borrow()?;
    let mut remaining = to_get.len();
    let mut offset = EscrowExtensionsHeader::LEN;

    while offset + TLV_HEADER_SIZE <= data.len() {
        let ext_type_raw = u16::from_le_bytes([data[offset], data[offset + 1]]);
        let ext_len = u16::from_le_bytes([data[offset + 2], data[offset + 3]]) as usize;

        let data_end = offset + TLV_HEADER_SIZE + ext_len;
        if data_end > data.len() {
            break;
        }

        if let Ok(ext_type) = ExtensionType::try_from(ext_type_raw) {
            if let Some(idx) = to_get.iter().position(|t| *t == ext_type) {
                results[idx] = Some(data[offset + TLV_HEADER_SIZE..data_end].to_vec());
                remaining -= 1;
                if remaining == 0 {
                    break;
                }
            }
        }

        offset = data_end;
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extension_type_try_from() {
        assert_eq!(ExtensionType::try_from(0u16).unwrap(), ExtensionType::Timelock);
        assert_eq!(ExtensionType::try_from(1u16).unwrap(), ExtensionType::Hook);
        assert_eq!(ExtensionType::try_from(2u16).unwrap(), ExtensionType::BlockedTokenExtensions);
        assert_eq!(ExtensionType::try_from(3u16).unwrap(), ExtensionType::Arbiter);
        assert!(ExtensionType::try_from(999u16).is_err());
    }

    #[test]
    fn test_header_new() {
        let header = EscrowExtensionsHeader::new(255, 1);

        assert_eq!(header.bump, 255);
        assert_eq!(header.extension_count, 1);
    }

    #[test]
    fn test_header_to_bytes() {
        let header = EscrowExtensionsHeader::new(100, 2);
        let bytes = header.to_bytes();

        assert_eq!(bytes.len(), EscrowExtensionsHeader::LEN);
        assert_eq!(bytes[0], EscrowExtensionsHeader::DISCRIMINATOR);
        assert_eq!(bytes[1], EscrowExtensionsHeader::VERSION); // version auto-prepended
        assert_eq!(bytes[2], 100); // bump
        assert_eq!(bytes[3], 2); // extension_count
    }

    #[test]
    fn test_header_from_bytes() {
        let header = EscrowExtensionsHeader::new(100, 2);
        let bytes = header.to_bytes();

        let parsed = EscrowExtensionsHeader::from_bytes(&bytes).unwrap();
        assert_eq!(parsed.bump, header.bump);
        assert_eq!(parsed.extension_count, header.extension_count);
    }

    #[test]
    fn test_header_from_bytes_wrong_version() {
        let header = EscrowExtensionsHeader::new(100, 2);
        let mut bytes = header.to_bytes();
        bytes[1] = EscrowExtensionsHeader::VERSION.wrapping_add(1);

        let result = EscrowExtensionsHeader::from_bytes(&bytes);
        assert_eq!(result, Err(ProgramError::InvalidAccountData));
    }

    #[test]
    fn test_calculate_extensions_account_size() {
        let no_extensions = calculate_extensions_account_size(false);
        assert_eq!(no_extensions, EscrowExtensionsHeader::LEN);

        let with_timelock = calculate_extensions_account_size(true);
        assert_eq!(with_timelock, EscrowExtensionsHeader::LEN + TLV_HEADER_SIZE + TimelockData::LEN);
    }

    #[test]
    fn test_extensions_pda_seeds() {
        let escrow = Address::new_from_array([1u8; 32]);
        let pda = ExtensionsPda::new(&escrow);

        let seeds = pda.seeds();
        assert_eq!(seeds.len(), 2);
        assert_eq!(seeds[0], b"extensions");
        assert_eq!(seeds[1], escrow.as_ref());
    }
}
