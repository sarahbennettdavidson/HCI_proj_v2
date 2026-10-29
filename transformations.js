// Matrix multiplication
function multiplyMat4(a, b) {
    let r = new Float32Array(16);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
            sum += a[k * 4 + i] * b[j * 4 + k]; 
        }
        r[j * 4 + i] = sum;
    }
    return r;
}

// Multiply matrices left to right, e.g. matMul(A, B, C) is A * B * C.
// JavaScript has no operator overloading, GLSL does overload `*` for mat4
function matMul(...matrices) {
    return matrices.reduce(multiplyMat4);
}

// Orthographic matrix
function ortho(left, right, bottom, top, near, far) {
    const lr = 1 / (left - right), bt = 1 / (bottom - top), nf = 1 / (near - far);
    return new Float32Array([
        -2*lr, 0, 0, 0,
        0, -2*bt, 0, 0,
        0, 0, 2*nf, 0,
        (left+right)*lr, (top+bottom)*bt, (far+near)*nf, 1
    ]);
}

// Identity matrix
function mat4Identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

// Matrix translation
function mat4Translate(matrix, translation) {
    const result = new Float32Array(matrix);
    result[12] = matrix[0] * translation[0] + matrix[4] * translation[1] + matrix[8] * translation[2] + matrix[12];
    result[13] = matrix[1] * translation[0] + matrix[5] * translation[1] + matrix[9] * translation[2] + matrix[13];
    result[14] = matrix[2] * translation[0] + matrix[6] * translation[1] + matrix[10] * translation[2] + matrix[14];
    result[15] = matrix[3] * translation[0] + matrix[7] * translation[1] + matrix[11] * translation[2] + matrix[15];
    return result;
}

// Matrix rotation around X axis
function mat4RotateX(matrix, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const result = new Float32Array(matrix);

    const mv1 = matrix[4], mv5 = matrix[5], mv9 = matrix[6], mv13 = matrix[7];
    const mv2 = matrix[8], mv6 = matrix[9], mv10 = matrix[10], mv14 = matrix[11];

    result[4] = mv1 * c + mv2 * s;
    result[5] = mv5 * c + mv6 * s;
    result[6] = mv9 * c + mv10 * s;
    result[7] = mv13 * c + mv14 * s;
    result[8] = mv2 * c - mv1 * s;
    result[9] = mv6 * c - mv5 * s;
    result[10] = mv10 * c - mv9 * s;
    result[11] = mv14 * c - mv13 * s;

    return result;
}

// Matrix rotation around Y axis
function mat4RotateY(matrix, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const result = new Float32Array(matrix);

    const mv0 = matrix[0], mv4 = matrix[1], mv8 = matrix[2], mv12 = matrix[3];
    const mv2 = matrix[8], mv6 = matrix[9], mv10 = matrix[10], mv14 = matrix[11];

    result[0] = mv0 * c - mv2 * s;
    result[1] = mv4 * c - mv6 * s;
    result[2] = mv8 * c - mv10 * s;
    result[3] = mv12 * c - mv14 * s;
    result[8] = mv0 * s + mv2 * c;
    result[9] = mv4 * s + mv6 * c;
    result[10] = mv8 * s + mv10 * c;
    result[11] = mv12 * s + mv14 * c;

    return result;
}

// matrix rotation around z 
function mat4RotateZ(matrix, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const result = new Float32Array(matrix);

    const mv0 = matrix[0], mv4 = matrix[1], mv8 = matrix[2], mv12 = matrix[3];
    const mv1 = matrix[4], mv5 = matrix[5], mv9 = matrix[6], mv13 = matrix[7];

    result[0] = mv0 * c + mv1 * s;
    result[1] = mv4 * c + mv5 * s;
    result[2] = mv8 * c + mv9 * s;
    result[3] = mv12 * c + mv13 * s;
    result[4] = mv1 * c - mv0 * s;
    result[5] = mv5 * c - mv4 * s;
    result[6] = mv9 * c - mv8 * s;
    result[7] = mv13 * c - mv12 * s;

    return result;
}

// Matrix shear along X: x' = x + shx*y
function mat4ShearX(matrix, shx) {
    const result = new Float32Array(matrix);

    result[4] = matrix[4] + matrix[0] * shx;
    result[5] = matrix[5] + matrix[1] * shx;
    result[6] = matrix[6] + matrix[2] * shx;
    result[7] = matrix[7] + matrix[3] * shx;

    return result;
}

// Matrix shear along Y: y' = y + shy*z
function mat4ShearY(matrix, shy) {
    const result = new Float32Array(matrix);

    result[8]  = matrix[8]  + matrix[4] * shy;
    result[9]  = matrix[9]  + matrix[5] * shy;
    result[10] = matrix[10] + matrix[6] * shy;
    result[11] = matrix[11] + matrix[7] * shy;

    return result;
}

// Matrix shear along Z: z' = z + shz*x
function mat4ShearZ(matrix, shz) {
    const result = new Float32Array(matrix);

    result[0] = matrix[0] + matrix[8]  * shz;
    result[1] = matrix[1] + matrix[9]  * shz;
    result[2] = matrix[2] + matrix[10] * shz;
    result[3] = matrix[3] + matrix[11] * shz;

    return result;
}

// Matrix scaling
function mat4Scale(matrix, scale) {
    const result = new Float32Array(matrix);

    result[0]  = matrix[0]  * scale[0];
    result[1]  = matrix[1]  * scale[0];
    result[2]  = matrix[2]  * scale[0];
    result[3]  = matrix[3]  * scale[0];
    result[4]  = matrix[4]  * scale[1];
    result[5]  = matrix[5]  * scale[1];
    result[6]  = matrix[6]  * scale[1];
    result[7]  = matrix[7]  * scale[1];
    result[8]  = matrix[8]  * scale[2];
    result[9]  = matrix[9]  * scale[2];
    result[10] = matrix[10] * scale[2];
    result[11] = matrix[11] * scale[2];

    return result;
}






// [optional] Helper function converting math format row-major matrices into a flat column-major array.
// function mat4FromRows(m00, m01, m02, m03,
//                       m10, m11, m12, m13,
//                       m20, m21, m22, m23,
//                       m30, m31, m32, m33) {
//     return new Float32Array([
//         m00, m10, m20, m30,   // column 0
//         m01, m11, m21, m31,   // column 1
//         m02, m12, m22, m32,   // column 2
//         m03, m13, m23, m33    // column 3
//     ]);
// }
