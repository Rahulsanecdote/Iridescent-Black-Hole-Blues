from PIL import Image, ImageDraw
import sys

def remove_background(input_path, output_path):
    print(f"Processing {input_path}...")
    try:
        img = Image.open(input_path).convert("RGBA")
        
        # Flood fill approach
        # We will flood fill the background with transparent pixels (0,0,0,0)
        # Starting from the corners
        
        width, height = img.size
        draw = ImageDraw.Draw(img)
        
        # Seed points: corners and mid-points of edges
        seeds = [
            (0, 0),
            (width-1, 0),
            (0, height-1),
            (width-1, height-1),
            (width//2, 0),
            (width//2, height-1),
            (0, height//2),
            (width-1, height//2)
        ]
        
        # Tolerance: How different the color can be to still be filled
        # 50 is about 20% difference, should cover gradients/shadows
        # but stop at the high-contrast black/blue edge of the butterfly
        thresh = 60 
        
        for seed in seeds:
            try:
                # Get color at seed to ensure we are filling background
                # If seed is already transparent, skip
                if img.getpixel(seed)[3] == 0:
                    continue
                    
                ImageDraw.floodfill(img, seed, (0, 0, 0, 0), thresh=thresh)
            except Exception as e:
                print(f"Floodfill error at {seed}: {e}")
        
        img.save(output_path)
        print(f"Saved to {output_path}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python remove_bg.py <input> <output>")
    else:
        remove_background(sys.argv[1], sys.argv[2])
