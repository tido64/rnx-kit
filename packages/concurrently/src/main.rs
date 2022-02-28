extern crate exitcode;

use rayon::prelude::*;
use serde_json::Value;
use std::io::Write;
use std::process::{Command, Stdio};
use std::time::Instant;

fn execute(script: &str) {
    let mut args: Vec<&str> = script.split_whitespace().collect();
    if args.len() == 0 {
        return;
    }

    args.rotate_left(1);
    let exec = args.pop().unwrap();

    let time = Instant::now();
    let child = Command::new(exec)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap_or_else(|err| {
            eprintln!("Failed to invoke `{}`: {}", script, err);
            std::process::exit(exitcode::OSERR);
        });

    let output = child.wait_with_output().unwrap_or_else(|err| {
        eprintln!("Failed waiting for process `{}`: {}", script, err);
        std::process::exit(exitcode::SOFTWARE);
    });

    println!("{} ({:.2?})", script, time.elapsed());

    std::io::stdout().write_all(&output.stdout).unwrap();
    std::io::stderr().write_all(&output.stderr).unwrap();

    match output.status.code() {
        Some(code) => {
            if code != 0 {
                eprintln!("`{}` failed with exit code {}", script, code);
                std::process::exit(code);
            }
        }
        None => {
            eprintln!("`{}` was terminated by signal", script);
            std::process::exit(exitcode::SOFTWARE);
        }
    }
}

fn main() {
    let jobs = std::env::args().skip(1);
    let size = jobs.len();
    if size == 0 {
        return;
    }

    let package_json = "package.json";

    let contents = std::fs::read_to_string(package_json).unwrap_or_else(|err| {
        eprintln!("Failed to open `{}`: {}", package_json, err);
        std::process::exit(exitcode::NOINPUT);
    });

    let result: Value = serde_json::from_str(&contents).unwrap_or_else(|err| {
        eprintln!("Failed to parse `{}`: {}", package_json, err);
        std::process::exit(exitcode::DATAERR);
    });

    match result["scripts"] {
        Value::Object(ref scripts) => {
            jobs.collect::<Vec<String>>()
                .par_iter()
                .for_each(|job| match scripts.get(job) {
                    Some(script) => {
                        if script.is_string() {
                            execute(script.as_str().unwrap());
                        }
                    }
                    None => eprintln!("No such script: {}", job),
                });
        }
        _ => {
            eprintln!("No scripts found: {}", package_json);
            std::process::exit(exitcode::DATAERR);
        }
    }
}
