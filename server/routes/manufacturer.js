// backend/routes/manufacturer.js
const express = require('express');
const router = express.Router();
const Manufacturer = require('../models/Manufacturer');
const DeviceModel = require('../models/DeviceModel');

router.get('/', async (req, res) => {
    try {
        const manufacturers = await Manufacturer.find().sort({ name: 1 });
        res.json(manufacturers);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi server khi lấy danh sách hãng.' });
    }
});

router.get('/:id/models', async (req, res) => {
    try {
        const models = await DeviceModel.find({ manufacturer: req.params.id }).sort({ modelName: 1 });
        res.json(models);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi server khi lấy danh sách model.' });
    }
});


router.post('/', async (req, res) => {
    try {
        const newManufacturer = new Manufacturer({ name: req.body.name, website: req.body.website });
        await newManufacturer.save();
        res.status(201).json(newManufacturer);
    } catch (err) {
        res.status(400).json({ error: 'Không thể tạo hãng mới.' });
    }
});

router.post('/models', async (req, res) => {
    try {
        const newModel = new DeviceModel({
            manufacturer: req.body.manufacturerId,
            modelName: req.body.modelName,
            protocol: req.body.protocol,
        });
        await newModel.save();
        res.status(201).json(newModel);
    } catch (err) {
        res.status(400).json({ error: 'Không thể tạo model mới.' });
    }
});


module.exports = router;