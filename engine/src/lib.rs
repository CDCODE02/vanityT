use wasm_bindgen::prelude::*;
use rand_core::{RngCore, SeedableRng};
use rand_chacha::ChaCha20Rng;
use k256::ecdsa::SigningKey;
use k256::elliptic_curve::sec1::ToEncodedPoint;
use sha3::{Digest, Keccak256};
use zeroize::Zeroize;

#[wasm_bindgen]
pub struct MatchResult {
    private_key: String,
    address: String,
}

#[wasm_bindgen]
impl MatchResult {
    #[wasm_bindgen(getter)]
    pub fn private_key(&self) -> String {
        self.private_key.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn address(&self) -> String {
        self.address.clone()
    }
}

#[wasm_bindgen]
pub struct VanityEngine {
    rng: ChaCha20Rng,
}

#[wasm_bindgen]
impl VanityEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: &[u8]) -> Self {
        let mut seed_array = [0u8; 32];
        let len = seed.len().min(32);
        seed_array[..len].copy_from_slice(&seed[..len]);
        Self {
            rng: ChaCha20Rng::from_seed(seed_array),
        }
    }

    #[wasm_bindgen]
    pub fn search_batch(
        &mut self,
        prefix: &[u8],
        prefix_mask: &[u8],
        suffix: &[u8],
        suffix_mask: &[u8],
        batch_size: u32,
    ) -> Option<MatchResult> {
        let mut private_key = [0u8; 32];
        let prefix_len = prefix.len();
        let suffix_len = suffix.len();

        for _ in 0..batch_size {
            self.rng.fill_bytes(&mut private_key);

            // Derive public key
            let signing_key = match SigningKey::from_slice(&private_key) {
                Ok(k) => k,
                Err(_) => continue, // Invalid scalar, very rare
            };
            
            let verifying_key = signing_key.verifying_key();
            let encoded_point = verifying_key.to_encoded_point(false);
            let pubkey_bytes = encoded_point.as_bytes(); // first byte is 0x04

            // Hash with Keccak256, skipping the 0x04 prefix
            let mut hasher = Keccak256::new();
            hasher.update(&pubkey_bytes[1..]);
            let hash = hasher.finalize();

            // The address is the last 20 bytes of the hash
            let address = &hash[12..32];

            // Check prefix
            let mut is_match = true;
            for i in 0..prefix_len {
                if (address[i] & prefix_mask[i]) != prefix[i] {
                    is_match = false;
                    break;
                }
            }

            if is_match {
                // Check suffix
                // For suffix, we offset from the end.
                let offset = 20 - suffix_len;
                for i in 0..suffix_len {
                    if (address[offset + i] & suffix_mask[i]) != suffix[i] {
                        is_match = false;
                        break;
                    }
                }

                if is_match {
                    let priv_hex = format!("0x{}", hex::encode(private_key));
                    let addr_hex = format!("0x{}", hex::encode(address));
                    
                    // Zero out memory
                    private_key.zeroize();
                    
                    return Some(MatchResult {
                        private_key: priv_hex,
                        address: addr_hex,
                    });
                }
            }
        }

        // Zero out the last tried private key memory to be safe
        private_key.zeroize();
        None
    }
}
