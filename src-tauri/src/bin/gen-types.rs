#[path = "../codegen.rs"]
mod codegen;

fn main() -> std::io::Result<()> {
    let src = std::fs::read_to_string("../src/generated/xap.ts")?;
    let (types, tauri) = codegen::split_generated(&src);
    std::fs::write("../src/generated/xap-types.ts", types)?;
    std::fs::write("../src/generated/xap-tauri.ts", tauri)?;
    println!("wrote xap-types.ts and xap-tauri.ts");
    Ok(())
}
