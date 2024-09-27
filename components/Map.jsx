import React, { useRef, useState, useEffect } from "react";

const Map = () => {
  const canvasRef = useRef(null);
  const [mapData, setMapData] = useState({});
  const [images, setImages] = useState({});
  const [imageOpacity, setImageOpacity] = useState({});
  const [imageTimers, setImageTimers] = useState({});

  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scale, setScale] = useState(0.3);

  const tileSize = 256;
  const mapWidth = 2; // Number of columns
  const mapHeight = 2; // Number of rows
  const prefetchRadius = 1; // Number of tiles to prefetch
  const zoomSensitivity = 0.001;
  const maxScale = 1;
  const minScale = 0.1;

  // Initialize mapData
  useEffect(() => {
    let initialMapData = {};
    for (let row = 0; row <= 19; row++) {
      for (let column = 0; column <= 19; column++) {
        initialMapData[JSON.stringify([row, column])] = `images/row-${
          row + 1
        }-column-${column + 1}.webp`;
      }
    }
    setMapData(initialMapData);
    console.log(initialMapData);
  }, []);

  // Function to check if a tile is visible
  const isTileVisible = (x, y) => {
    const viewXStart = -offsetX / scale;
    const viewYStart = -offsetY / scale;
    const viewXEnd = viewXStart + canvasRef.current.width / scale;
    const viewYEnd = viewYStart + canvasRef.current.height / scale;

    return (
      x + tileSize > viewXStart &&
      x < viewXEnd &&
      y + tileSize > viewYStart &&
      y < viewYEnd
    );
  };

  // Function to get surrounding tiles for prefetching
  const getSurroundingTiles = ([x, y]) => {
    const surroundingTiles = [];
    for (let i = -prefetchRadius; i <= prefetchRadius; i++) {
      for (let j = -prefetchRadius; j <= prefetchRadius; j++) {
        if (i === 0 && j === 0) continue;
        surroundingTiles.push([x + i, y + j]);
      }
    }
    return surroundingTiles;
  };

  // Fade in image effect
  const fadeInImage = (key, coords) => {
    const fadeDuration = 100;
    const steps = 20;
    const fadeStep = 1 / steps;
    let currentStep = 0;
    let opacity = 0;

    setImageOpacity((prev) => ({ ...prev, [key]: opacity }));

    const stepFadeIn = () => {
      currentStep++;
      opacity += fadeStep;
      setImageOpacity((prev) => ({
        ...prev,
        [key]: Math.min(opacity, 1),
      }));

      drawMap(); // Redraw map on every step

      if (currentStep < steps) {
        requestAnimationFrame(stepFadeIn);
      }
    };

    requestAnimationFrame(stepFadeIn);
  };

  // Function to draw the map
  const drawMap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(offsetX / scale, offsetY / scale);

    Object.keys(mapData).forEach((key) => {
      const coords = JSON.parse(key);
      const xPos = tileSize * coords[1] + 10;
      const yPos = tileSize * coords[0] + 10;

      if (isTileVisible(xPos, yPos)) {
        if (!images[key]) {
          if (!imageTimers[key]) {
            setImageTimers((prevTimers) => ({
              ...prevTimers,
              [key]: setTimeout(() => {
                let img = new Image();
                img.src = mapData[key];
                img.onload = () => {
                  setImages((prevImages) => ({ ...prevImages, [key]: img }));
                  fadeInImage(key, coords);

                  // Load surrounding tiles
                  getSurroundingTiles(coords).forEach(([sx, sy]) => {
                    const surroundingKey = JSON.stringify([sx, sy]);
                    if (!images[surroundingKey] && mapData[surroundingKey]) {
                      let surroundingImg = new Image();
                      surroundingImg.src = mapData[surroundingKey];
                      surroundingImg.onload = () => {
                        setImages((prevImages) => ({
                          ...prevImages,
                          [surroundingKey]: surroundingImg,
                        }));
                        fadeInImage(surroundingKey, [sx, sy]);
                      };
                    }
                  });
                };
              }, 0),
            }));
          }
        } else {
          // Set opacity
          let opacity = imageOpacity[key] !== undefined ? imageOpacity[key] : 1;
          ctx.globalAlpha = opacity;
          ctx.drawImage(images[key], xPos, yPos, tileSize, tileSize);
          ctx.globalAlpha = 1; // Reset opacity
        }
      } else {
        // Unload images
        setImages((prevImages) => {
          const { [key]: removedImage, ...rest } = prevImages;
          return rest;
        });

        clearTimeout(imageTimers[key]);
        setImageTimers((prevTimers) => {
          const { [key]: removedTimer, ...rest } = prevTimers;
          return rest;
        });
      }
    });

    ctx.restore();
  };

  // Handle mouse down for dragging
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.clientX - offsetX);
    setStartY(e.clientY - offsetY);
  };

  // Handle mouse move for dragging
  const handleMouseMove = (e) => {
    if (isDragging) {
      setOffsetX(e.clientX - startX);
      setOffsetY(e.clientY - startY);
      drawMap(); // Redraw the map with new offsets
    }
  };

  // Handle mouse up to stop dragging
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle zooming
  const handleWheel = (e) => {
    const zoom = e.deltaY * zoomSensitivity;
    const newScale = Math.min(maxScale, Math.max(minScale, scale - zoom));
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;

    const scaleRatio = newScale / scale;

    setOffsetX((prev) => prev - (mouseX - prev) * (scaleRatio - 1));
    setOffsetY((prev) => prev - (mouseY - prev) * (scaleRatio - 1));
    setScale(newScale);

    drawMap();
    e.preventDefault();
  };

  // Initial draw of the map
  useEffect(() => {
    drawMap();
  }, [scale, offsetX, offsetY, images, imageOpacity]);

  return (
    <canvas
      ref={canvasRef}
      width={tileSize * mapWidth}
      height={tileSize * mapHeight}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
    />
  );
};

export default Map;
