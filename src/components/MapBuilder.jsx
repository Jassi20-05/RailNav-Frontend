import React, { useRef, useState, useEffect } from 'react';
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { CloudLightning, CodeSquare, ZoomIn, ZoomOut } from 'lucide-react';

const MapBuilder = () => {
    const canvas = useRef(null);
    const [shapes, setShapes] = useState([]);
    const [isPanning, setIsPanning] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
    const [edit, setEdit] = useState(true)
    const [isEditing, setIsEditing] = useState(false);
    const [shapeSizeToAdd, setShapeSizeToAdd] = useState(5);
    const [zoom, setZoom] = useState(1); // New state for zoom level

    const render = () => {
        if (!canvas.current) return
        const c = canvas.current
        const ctx = c.getContext("2d");
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.save(); // Save the current state
        ctx.scale(zoom, zoom); // Apply zoom
        drawGrid();
        drawShapes();
        ctx.restore(); // Restore the original state
    }

    const drawGrid = () => {
        if (!canvas.current) return
        const c = canvas.current
        const ctx = c.getContext("2d");
        const numberOfRows = 100
        const numberOfCols = 100
        for (let i = 0; i < numberOfRows + 1; i++) {
            ctx.strokeRect(canvasOffset.x, canvasOffset.y + (32 * i), 32 * numberOfRows, 0);
        }
        for (let i = 0; i < numberOfCols + 1; i++) {
            ctx.strokeRect(canvasOffset.x + (32 * i), canvasOffset.y, 0, 32 * numberOfCols);
        }
    }

    const clearNodes = () => {
        setShapes(()=>(shapes.filter((shape)=>(shape.type !== "node"))))
    }

    const drawShapes = () => {
        const c = canvas.current
        const ctx = c.getContext("2d");
        shapes.forEach((shape) => {
            ctx.beginPath();
            if (shape.type === 'square') {
                ctx.rect(shape.x + canvasOffset.x, shape.y + canvasOffset.y, shape.size, shape.size);
            } else if (shape.type === 'circle') {
                ctx.arc(shape.x + canvasOffset.x, shape.y + canvasOffset.y, shape.size / 2, 0, Math.PI * 2);
            } else if (shape.type === "node") {
                ctx.arc(shape.x + canvasOffset.x, shape.y + canvasOffset.y, 4 / 2, 0, Math.PI * 2);
            } else if (shape.type === "polygon") {
                for (let i = 0; i < shape.coords.length; i++) {
                    if (i == 0) {
                        ctx.beginPath();
                        ctx.moveTo(shape.coords[i][0] + canvasOffset.x, shape.coords[i][1] + canvasOffset.y);
                    }
                    else if (i == shape.coords.length - 1) {
                        ctx.lineTo(shape.coords[i][0] + canvasOffset.x, shape.coords[i][1] + canvasOffset.y);
                    }
                    else {
                        ctx.lineTo(shape.coords[i][0] + canvasOffset.x, shape.coords[i][1] + canvasOffset.y);
                    }
                }
            }
            ctx.fillStyle = shape.color;
            ctx.fill();
            ctx.closePath();
        });
    };

    const handleMouseDown = (e) => {
        if (e.button == 1) {
            setIsPanning(true);
            setLastMousePos({ x: e.clientX, y: e.clientY });
        }
        else if (e.button == 0) {
            setIsEditing(true)
            setLastMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = (e) => {
        if (e.button == 1) {
            setIsPanning(false);
        }
        else if (e.button == 0) {
            setIsEditing(false)
        }
    };

    const handleMouseMove = (e) => {
        if (isPanning && !isEditing) {
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;

            setCanvasOffset((prevOffset) => ({
                x: prevOffset.x + dx / zoom, // Adjust for zoom
                y: prevOffset.y + dy / zoom, // Adjust for zoom
            }));
        }
        else if (edit && isEditing) {
            const rect = canvas.current.getBoundingClientRect();
            const x = (e.clientX - rect.left - canvasOffset.x * zoom) / zoom; // Adjust for zoom
            const y = (e.clientY - rect.top - canvasOffset.y * zoom) / zoom; // Adjust for zoom
            const dx = (e.clientX - lastMousePos.x) / zoom; // Adjust for zoom
            const dy = (e.clientY - lastMousePos.y) / zoom; // Adjust for zoom
            let shapeToMove;
            shapes.forEach(shape => {
                if (shape.type === "circle") {
                    if ((x - shape.x) * (x - shape.x) +
                        (y - shape.y) * (y - shape.y) <= shape.size / 2 * shape.size / 2) {
                        shapeToMove = shape
                        setShapes(shapes.map((s) => {
                            if (shapeToMove.uuid == s.uuid) {
                                return { ...s, x: s.x + dx, y: s.y + dy };
                            }
                            else {
                                return { ...s }
                            }
                        }));
                    }
                }
                else if (shape.type === "square") {
                    if (x > shape.x && x < shape.x + shape.size && y > shape.y && y < shape.y + shape.size) {
                        shapeToMove = shape
                        setShapes(shapes.map((s) => {
                            if (shapeToMove.uuid == s.uuid) {
                                return { ...s, x: s.x + dx, y: s.y + dy };
                            }
                            else {
                                return { ...s }
                            }
                        }));
                    }
                }
                else if (shape.type === "polygon") {
                    const isInside = isPointInPolygon(x, y, shape.coords);
                    if (isInside) {
                        shapeToMove = shape;
                        setShapes(shapes.map((s) => {
                            if (shapeToMove.uuid === s.uuid) {
                                return {
                                    ...s,
                                    coords: s.coords.map(coord => [coord[0] + dx, coord[1] + dy])
                                };
                            } else {
                                return { ...s };
                            }
                        }));
                    }
                }
            });
        }
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const isPointInPolygon = (x, y, polygon) => {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i][0], yi = polygon[i][1];
            const xj = polygon[j][0], yj = polygon[j][1];
            
            const intersect = ((yi > y) !== (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    const handleMouseClick = (e) => {
        const rect = canvas.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - canvasOffset.x * zoom) / zoom; // Adjust for zoom
        const y = (e.clientY - rect.top - canvasOffset.y * zoom) / zoom; // Adjust for zoom
        if (!edit) {
            console.log(x, y, x + canvasOffset.x, y + canvasOffset.y);
        }
        else if (polygonMode) {
            console.log(true);
            console.log([x, y]);
            setPolygonData((prev) => ([...prev, [x, y]]))
        }
    }

    const addShape = (shape, x = 0, y = 0) => {
        if (isPanning || !edit) return 0;
        let uuid = self.crypto.randomUUID();
        setShapes((prev) => (
            [...prev, { type: shape, x, y, size: shapeSizeToAdd * 32, color: 'blue', uuid: uuid }]
        ))
        render()
    }

    const changeBackground = (color) => {
        const c = canvas.current
        const ctx = c.getContext("2d");
        ctx.clearRect(0, 0, c.width, c.height);
        if (color == "transparent") {
            drawGrid()
            drawShapes()
            render()
        }
        else {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, c.width, c.height);
            drawShapes()
        }
    }

    const [polygonMode, setPolygonMode] = useState(false)
    const [polygonData, setPolygonData] = useState([])

    const addPolygon = (x, y, node) => {
        console.log(x, y);
        const c = canvas.current
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#f00';
        switch (node) {
            case 0:
                addShape("node", x, y)
                break
            case 1:
                addShape("node", x, y)
                break
            case 2:
                addShape("node", x, y)
                break
            case 3:
                let uuid = self.crypto.randomUUID();
                setShapes((prev) => ([...prev, { type: "polygon", coords: polygonData, color: 'pink', uuid: uuid }]))
                setPolygonData([])
                console.log({ polygonData });
        }
    }

    useEffect(() => {
        if (polygonData.length == 0) return
        addPolygon(polygonData[polygonData.length - 1][0], polygonData[polygonData.length - 1][1], polygonData.length - 1)
    }, [polygonData])

    useEffect(() => {
        setShapes([
            { type: 'square', x: 0, y: 0, size: 100, color: 'blue', uuid: "1" },
            { type: 'circle', x: 100, y: 100, size: 100, color: 'red', uuid: "2" },
        ])
    }, [])

    useEffect(() => {
        if (!canvas.current) return
        render()
    }, [canvasOffset, shapes, zoom]) // Added zoom to dependencies

    // Modified download function to capture the entire map
    const downloadCanvas = () => {
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');

        // Calculate the bounds of all shapes
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        shapes.forEach(shape => {
            if (shape.type === 'square' || shape.type === 'circle') {
                minX = Math.min(minX, shape.x);
                minY = Math.min(minY, shape.y);
                maxX = Math.max(maxX, shape.x + shape.size);
                maxY = Math.max(maxY, shape.y + shape.size);
            } else if (shape.type === 'polygon') {
                shape.coords.forEach(coord => {
                    minX = Math.min(minX, coord[0]);
                    minY = Math.min(minY, coord[1]);
                    maxX = Math.max(maxX, coord[0]);
                    maxY = Math.max(maxY, coord[1]);
                });
            }
        });

        // Add some padding
        const padding = 50;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        // Set canvas size to fit all shapes
        tempCanvas.width = maxX - minX;
        tempCanvas.height = maxY - minY;

        // Draw white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Draw shapes
        shapes.forEach((shape) => {
            ctx.beginPath();
            if (shape.type === 'square') {
                ctx.rect(shape.x - minX, shape.y - minY, shape.size, shape.size);
            } else if (shape.type === 'circle') {
                ctx.arc(shape.x - minX, shape.y - minY, shape.size / 2, 0, Math.PI * 2);
            } else if (shape.type === "polygon") {
                shape.coords.forEach((coord, index) => {
                    if (index === 0) {
                        ctx.moveTo(coord[0] - minX, coord[1] - minY);
                    } else {
                        ctx.lineTo(coord[0] - minX, coord[1] - minY);
                    }
                });
                ctx.closePath();
            }
            ctx.fillStyle = shape.color;
            ctx.fill();
        });

        // Create download link
        const link = document.createElement('a');
        link.download = 'map.png';
        link.href = tempCanvas.toDataURL();
        link.click();
    };

    // New zoom functions
    const zoomIn = () => {
        setZoom(prevZoom => Math.min(prevZoom * 1.2, 5)); // Limit max zoom to 5x
    };

    const zoomOut = () => {
        setZoom(prevZoom => Math.max(prevZoom / 1.2, 0.1)); // Limit min zoom to 0.1x
    };

    return (
        <div className='flex items-center justify-center h-full w-full gap-2'>
            <div className='w-[15%] flex flex-col gap-2'>
                {
                    edit && !polygonMode ? <div>Edit Mode</div> : polygonMode ? <div>Polygon Mode</div> : null
                }
                <Button className='' onClick={() => { addShape("square") }}>Square</Button>
                <Button className='' onClick={() => { addShape("circle") }}>Circle</Button>
                <Button className='' onClick={() => { setPolygonMode(!polygonMode) }}>Polygon</Button>
                <Button onClick={() => { setEdit(!edit); changeBackground("transparent") }}>Edit</Button>
                <Button onClick={() => { changeBackground("white") }}>Output Mode</Button>
                <Button onClick={() => { }}>Remove</Button>
                <Input type='number' placeholder={"Enter Size in meter"} value={shapeSizeToAdd} onChange={(e) => { setShapeSizeToAdd(e.target.value) }} ></Input>
                <Button onClick={downloadCanvas}>Download Map</Button>
                {/* New zoom buttons */}
                <Button onClick={zoomIn}><ZoomIn className="mr-2" /> Zoom In</Button>
                <Button onClick={zoomOut}><ZoomOut className="mr-2" /> Zoom Out</Button>
            </div>
            <div className='w-[80%] border h-full grid items-center overflow-hidden'>
                <canvas
                    ref={canvas}
                    width={1200}
                    height={600}
                    style={{ border: '1px solid black' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseOut={handleMouseUp}
                    onClick={handleMouseClick}
                />
            </div>
        </div>
    )
};

export default MapBuilder;