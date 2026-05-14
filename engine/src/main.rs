use clap::Parser;
use k256::{ProjectivePoint, Scalar, elliptic_curve::{sec1::ToEncodedPoint, PrimeField}, FieldBytes};
use rand::RngCore;
use rayon::prelude::*;
use sha3::{Digest, Keccak256};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use std::io::{Write, stdout};

// Cryptography imports
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit},
    Aes256Gcm, Nonce
};
use pbkdf2::pbkdf2_hmac;
use sha2::Sha256;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long, default_value = "")]
    prefix: String,

    #[arg(short, long, default_value = "")]
    suffix: String,

    #[arg(short, long, default_value_t = 1000000)]
    batch_size: usize,
}

fn encrypt_payload(password: &str, plaintext: &str) -> String {
    let mut rng = rand::thread_rng();

    // 1. Generate 16-byte salt
    let mut salt = [0u8; 16];
    rng.fill_bytes(&mut salt);

    // 2. Derive 32-byte (256-bit) key using PBKDF2-HMAC-SHA256 (100,000 iterations)
    let mut key_bytes = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, 100_000, &mut key_bytes);

    // 3. Initialize AES-256-GCM
    let cipher = Aes256Gcm::new(&key_bytes.into());

    // 4. Generate 12-byte nonce (IV)
    let nonce = Aes256Gcm::generate_nonce(&mut rng);

    // 5. Encrypt the plaintext (AES-GCM automatically appends the 16-byte auth tag)
    let ciphertext = cipher.encrypt(&nonce, plaintext.as_bytes()).expect("Encryption failed!");

    // 6. Combine: [Salt (16)] + [Nonce (12)] + [Ciphertext + Tag]
    let mut payload = Vec::new();
    payload.extend_from_slice(&salt);
    payload.extend_from_slice(&nonce);
    payload.extend_from_slice(&ciphertext);

    // 7. Base64 encode the final binary payload
    BASE64.encode(payload)
}

fn main() {
    let args = Args::parse();

    // Prompt for encryption password securely
    print!("🔒 Enter an encryption password for the output: ");
    stdout().flush().unwrap();
    let password = rpassword::read_password().expect("Failed to read password");
    
    if password.trim().is_empty() {
        println!("❌ Password cannot be empty. Security is mandatory!");
        std::process::exit(1);
    }

    let prefix_bytes = hex::decode(args.prefix.trim_start_matches("0x")).expect("Invalid prefix hex");
    let suffix_bytes = hex::decode(args.suffix.trim_start_matches("0x")).expect("Invalid suffix hex");

    println!("🚀 Starting high-performance native search...");
    println!("🎯 Target Prefix: 0x{}", hex::encode(&prefix_bytes));
    println!("🎯 Target Suffix: 0x{}", hex::encode(&suffix_bytes));
    println!("🧵 Using all {} logical cores", rayon::current_num_threads());

    let running = Arc::new(AtomicBool::new(true));
    let start_time = Instant::now();
    let total_attempts = Arc::new(std::sync::atomic::AtomicU64::new(0));

    // Stats printing thread
    let stats_running = running.clone();
    let stats_attempts = total_attempts.clone();
    std::thread::spawn(move || {
        let mut last_attempts = 0;
        let mut last_time = Instant::now();
        while stats_running.load(Ordering::Relaxed) {
            std::thread::sleep(std::time::Duration::from_millis(1000));
            let current_attempts = stats_attempts.load(Ordering::Relaxed);
            let now = Instant::now();
            let delta_attempts = current_attempts - last_attempts;
            let delta_time = now.duration_since(last_time).as_secs_f64();
            
            println!(
                "📊 Speed: {:.2} MH/s | Total: {} | Time: {}s",
                (delta_attempts as f64 / delta_time) / 1_000_000.0,
                current_attempts,
                now.duration_since(start_time).as_secs()
            );
            
            last_attempts = current_attempts;
            last_time = now;
        }
    });

    let pass_clone = password.clone();

    // Parallel search
    (0..rayon::current_num_threads()).into_par_iter().for_each(|_| {
        let mut rng = rand::thread_rng();
        let mut hasher = Keccak256::new();
        let step = ProjectivePoint::GENERATOR;

        while running.load(Ordering::Relaxed) {
            let mut priv_bytes = [0u8; 32];
            rng.fill_bytes(&mut priv_bytes);
            
            let mut scalar: Scalar = match Scalar::from_repr(*FieldBytes::from_slice(&priv_bytes)).into() {
                Some(s) => s,
                None => continue,
            };

            let mut current_point: ProjectivePoint = ProjectivePoint::GENERATOR * scalar;

            for _ in 0..args.batch_size {
                if !running.load(Ordering::Relaxed) { break; }

                let affine = current_point.to_affine();
                let encoded = affine.to_encoded_point(false);
                let pub_bytes = encoded.as_bytes();

                hasher.update(&pub_bytes[1..]);
                let hash = hasher.finalize_reset();
                let address = &hash[12..32];

                let prefix_match = address.starts_with(&prefix_bytes);
                let suffix_match = address.ends_with(&suffix_bytes);

                if prefix_match && suffix_match {
                    // Only one thread should enter here due to the atomic flag, but just in case
                    if running.swap(false, Ordering::SeqCst) {
                        let elapsed = start_time.elapsed();
                        let raw_pk = format!("0x{}", hex::encode(scalar.to_bytes()));
                        let addr_hex = format!("0x{}", hex::encode(address));

                        // Encrypt the private key!
                        let encrypted_pk = encrypt_payload(&pass_clone, &raw_pk);
                        
                        println!("\n✨ MATCH FOUND! ✨");
                        println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                        println!("📍 Address:       {}", addr_hex);
                        println!("🔐 Encrypted PK:  {}", encrypted_pk);
                        println!("⏱️  Time:          {:?}", elapsed);
                        println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                        println!("⚠️  Copy the Encrypted PK and use your local Web UI Decrypter to reveal it safely.");
                        
                        // Save to file as backup
                        if let Ok(mut file) = std::fs::File::create("match_found.txt") {
                            let _ = writeln!(file, "Address: {}", addr_hex);
                            let _ = writeln!(file, "Encrypted PK: {}", encrypted_pk);
                            println!("💾 Saved securely to match_found.txt");
                        }
                    }
                    return;
                }

                current_point += step;
                scalar += Scalar::ONE;
            }
            total_attempts.fetch_add(args.batch_size as u64, Ordering::Relaxed);
        }
    });
}
