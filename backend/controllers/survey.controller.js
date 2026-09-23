const FamilyModel = require('../models/family.model');
const {
    verifyMemberAccess,
    verifySubEntityAccess,
    verifyFollowUpAccess
} = require('../middleware/auth.middleware');
const { generateCsv, generatePdfStream, getStudentExportData } = require('../services/export.service');

const SurveyController = {
    // -------------------------------------------------------------
    // Families
    // -------------------------------------------------------------
    getFamilies(req, res) {
        try {
            const { search } = req.query;
            const rows = FamilyModel.getFamilies(req.studentId, search);
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getFamilyById(req, res) {
        try {
            const familyId = req.params.id;
            const result = FamilyModel.getFamilyById(familyId, req.studentId);
            if (result.notFound) {
                return res.status(404).json({ error: 'Family not found' });
            }
            if (result.forbidden) {
                return res.status(403).json({ error: 'Access denied. This household record belongs to another student cadre.' });
            }
            res.json(result.family);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getFamilyMembers(req, res) {
        try {
            const familyId = req.params.id;
            const { search, gender } = req.query;
            const result = FamilyModel.getFamilyMembers(familyId, req.studentId, search, gender);
            if (result.notFound) {
                return res.status(404).json({ error: 'Family not found' });
            }
            if (result.forbidden) {
                return res.status(403).json({ error: 'Access denied. This household belongs to another student cadre.' });
            }
            res.json(result.members);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    createFamily(req, res) {
        try {
            const result = FamilyModel.createFamily(req.studentId, req.body);
            if (result.badRequest) {
                return res.status(400).json({ error: result.message });
            }
            if (result.conflict) {
                return res.status(409).json({ error: result.message });
            }

            res.status(201).json({
                success: true,
                message: 'Family record created successfully',
                family_id: result.family_id,
                family_code: result.family_code,
                family_no: result.family_no,
                family: result.family,
                members_count: result.members_count
            });
        } catch (err) {
            console.error('Error saving family:', err);
            res.status(500).json({ error: err.message });
        }
    },

    updateFamily(req, res) {
        try {
            const familyId = req.params.id;
            const result = FamilyModel.updateFamily(familyId, req.studentId, req.body);
            if (result.notFound) {
                return res.status(404).json({ error: 'Family not found' });
            }
            if (result.forbidden) {
                return res.status(403).json({ error: 'Access denied. You cannot modify a household belonging to another student.' });
            }

            res.json({
                success: true,
                message: 'Family updated successfully',
                family: result.family
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    deleteFamily(req, res) {
        try {
            const familyId = req.params.id;
            const result = FamilyModel.deleteFamily(familyId, req.studentId);
            if (result.notFound) {
                return res.status(404).json({ error: 'Family not found' });
            }
            if (result.forbidden) {
                return res.status(403).json({ error: 'Access denied. You cannot delete a household belonging to another student.' });
            }

            res.json({ success: true, message: 'Family record deleted' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // -------------------------------------------------------------
    // Members
    // -------------------------------------------------------------
    addMember(req, res) {
        try {
            const familyId = req.params.id;
            const result = FamilyModel.addMember(familyId, req.studentId, req.body);
            if (result.notFound) {
                return res.status(404).json({ error: 'Family not found' });
            }
            if (result.forbidden) {
                return res.status(403).json({ error: 'Access denied. Cannot add members to another student\'s household.' });
            }
            if (result.badRequest) {
                return res.status(400).json({ error: result.message });
            }

            res.status(201).json({
                success: true,
                message: 'Member added successfully to family',
                member: result.member
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    updateMember(req, res) {
        try {
            const memberId = req.params.id;
            const result = FamilyModel.updateMember(memberId, req.studentId, req.body);
            if (result.notFound) {
                return res.status(404).json({ error: 'Member not found' });
            }
            if (result.forbidden) {
                return res.status(403).json({ error: 'Access denied. Cannot modify a member belonging to another student.' });
            }

            res.json({
                success: true,
                message: 'Member updated successfully',
                member: result.member
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getMemberById(req, res) {
        try {
            const memberId = req.params.id;
            const member = FamilyModel.getMemberById(memberId);
            if (!member) {
                return res.status(404).json({ error: 'Member not found' });
            }
            res.json(member);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    deleteMember(req, res) {
        try {
            const memberId = req.params.id;
            const deleted = FamilyModel.deleteMember(memberId);
            if (!deleted) {
                return res.status(404).json({ error: 'Member not found' });
            }
            res.json({ success: true, message: 'Member record deleted' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // -------------------------------------------------------------
    // Conditions
    // -------------------------------------------------------------
    getConditions(req, res) {
        if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
        try {
            const conditions = FamilyModel.getConditions(req.params.id);
            res.json(conditions);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    createCondition(req, res) {
        if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
        try {
            const { condition_name } = req.body;
            if (!condition_name || !condition_name.trim()) {
                return res.status(400).json({ error: 'Condition name is required' });
            }
            const condition = FamilyModel.createCondition(req.params.id, req.body);
            res.status(201).json({ success: true, message: 'Medical condition recorded', condition });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    updateCondition(req, res) {
        if (!verifySubEntityAccess('member_conditions', req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
        try {
            const { condition_name } = req.body;
            if (!condition_name || !condition_name.trim()) {
                return res.status(400).json({ error: 'Condition name is required' });
            }
            const updated = FamilyModel.updateCondition(req.params.id, req.body);
            if (!updated) return res.status(404).json({ error: 'Condition not found' });
            res.json({ success: true, message: 'Condition updated', condition: updated });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    deleteCondition(req, res) {
        if (!verifySubEntityAccess('member_conditions', req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
        try {
            const deleted = FamilyModel.deleteCondition(req.params.id);
            if (!deleted) return res.status(404).json({ error: 'Condition not found' });
            res.json({ success: true, message: 'Condition removed' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // -------------------------------------------------------------
    // Medications
    // -------------------------------------------------------------
    getMedications(req, res) {
        if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
        try {
            const medications = FamilyModel.getMedications(req.params.id);
            res.json(medications);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    createMedication(req, res) {
        if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
        try {
            const { medicine_name } = req.body;
            if (!medicine_name || !medicine_name.trim()) {
                return res.status(400).json({ error: 'Medication name is required' });
            }
            const medication = FamilyModel.createMedication(req.params.id, req.body);
            res.status(201).json({ success: true, message: 'Medication recorded', medication });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    updateMedication(req, res) {
        if (!verifySubEntityAccess('member_medications', req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
        try {
            const { medicine_name } = req.body;
            if (!medicine_name || !medicine_name.trim()) {
                return res.status(400).json({ error: 'Medication name is required' });
            }
            const updated = FamilyModel.updateMedication(req.params.id, req.body);
            if (!updated) return res.status(404).json({ error: 'Medication not found' });
            res.json({ success: true, message: 'Medication updated', medication: updated });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    deleteMedication(req, res) {
        if (!verifySubEntityAccess('member_medications', req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
        try {
            const deleted = FamilyModel.deleteMedication(req.params.id);
            if (!deleted) return res.status(404).json({ error: 'Medication not found' });
            res.json({ success: true, message: 'Medication removed' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // -------------------------------------------------------------
    // Allergies
    // -------------------------------------------------------------
    getAllergies(req, res) {
        if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
        try {
            const allergies = FamilyModel.getAllergies(req.params.id);
            res.json(allergies);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    createAllergy(req, res) {
        if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
        try {
            const { allergen } = req.body;
            if (!allergen || !allergen.trim()) {
                return res.status(400).json({ error: 'Allergen name is required' });
            }
            const allergy = FamilyModel.createAllergy(req.params.id, req.body);
            res.status(201).json({ success: true, message: 'Allergy recorded', allergy });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    updateAllergy(req, res) {
        if (!verifySubEntityAccess('member_allergies', req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
        try {
            const { allergen } = req.body;
            if (!allergen || !allergen.trim()) {
                return res.status(400).json({ error: 'Allergen name is required' });
            }
            const updated = FamilyModel.updateAllergy(req.params.id, req.body);
            if (!updated) return res.status(404).json({ error: 'Allergy not found' });
            res.json({ success: true, message: 'Allergy updated', allergy: updated });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    deleteAllergy(req, res) {
        if (!verifySubEntityAccess('member_allergies', req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
        try {
            const deleted = FamilyModel.deleteAllergy(req.params.id);
            if (!deleted) return res.status(404).json({ error: 'Allergy not found' });
            res.json({ success: true, message: 'Allergy removed' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // -------------------------------------------------------------
    // Medical History
    // -------------------------------------------------------------
    getHistory(req, res) {
        if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
        try {
            const history = FamilyModel.getHistory(req.params.id);
            res.json(history);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    createHistory(req, res) {
        if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
        try {
            const { description } = req.body;
            if (!description || !description.trim()) {
                return res.status(400).json({ error: 'Description is required' });
            }
            const history = FamilyModel.createHistory(req.params.id, req.body);
            res.status(201).json({ success: true, message: 'Medical history recorded', history });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    updateHistory(req, res) {
        if (!verifySubEntityAccess('member_medical_history', req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
        try {
            const { description } = req.body;
            if (!description || !description.trim()) {
                return res.status(400).json({ error: 'Description is required' });
            }
            const updated = FamilyModel.updateHistory(req.params.id, req.body);
            if (!updated) return res.status(404).json({ error: 'History record not found' });
            res.json({ success: true, message: 'Medical history updated', history: updated });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    deleteHistory(req, res) {
        if (!verifySubEntityAccess('member_medical_history', req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
        try {
            const deleted = FamilyModel.deleteHistory(req.params.id);
            if (!deleted) return res.status(404).json({ error: 'History record not found' });
            res.json({ success: true, message: 'Medical history removed' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // -------------------------------------------------------------
    // Lifestyle
    // -------------------------------------------------------------
    getLifestyle(req, res) {
        if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
        try {
            const lifestyle = FamilyModel.getLifestyle(req.params.id);
            res.json(lifestyle);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    saveLifestyle(req, res) {
        if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
        try {
            const lifestyle = FamilyModel.saveLifestyle(req.params.id, req.body);
            res.json({ success: true, message: 'Lifestyle recorded successfully', lifestyle });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // -------------------------------------------------------------
    // Follow-Ups
    // -------------------------------------------------------------
    createFollowUp(req, res) {
        try {
            const memberId = req.params.id;
            const member = verifyMemberAccess(memberId, req.studentId);
            if (!member) {
                return res.status(403).json({ error: 'Access denied. Member belongs to another student cadre.' });
            }

            const followUp = FamilyModel.createFollowUp(memberId, req.studentId, req.body);
            res.status(201).json({
                success: true,
                message: 'Follow-up visit recorded successfully',
                follow_up: followUp
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    deleteFollowUp(req, res) {
        try {
            const fuId = req.params.id;
            if (!verifyFollowUpAccess(fuId, req.studentId)) {
                return res.status(403).json({ error: 'Access denied. You cannot delete this follow-up visit.' });
            }
            const deleted = FamilyModel.deleteFollowUp(fuId);
            if (!deleted) {
                return res.status(404).json({ error: 'Follow-up not found' });
            }
            res.json({ success: true, message: 'Follow-up record deleted' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // -------------------------------------------------------------
    // Analytics
    // -------------------------------------------------------------
    getAnalyticsSummary(req, res) {
        try {
            const summary = FamilyModel.getAnalyticsSummary(req.studentId);
            res.json(summary);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getAnalyticsCharts(req, res) {
        try {
            const { gender, ageGroup, familyId } = req.query;
            const charts = FamilyModel.getAnalyticsCharts(req.studentId, { gender, ageGroup, familyId });
            res.json(charts);
        } catch (err) {
            console.error('Error in /analytics/charts:', err);
            res.status(500).json({ error: err.message });
        }
    },

    getAnalyticsReport(req, res) {
        try {
            const { reportId } = req.params;
            const result = FamilyModel.getAnalyticsReport(req.studentId, reportId);
            if (result.invalidReport) {
                return res.status(400).json({ error: 'Unknown report identifier' });
            }
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // -------------------------------------------------------------
    // Export
    // -------------------------------------------------------------
    exportCsv(req, res) {
        try {
            const csvData = generateCsv(req.studentId);
            const filename = `Roll_${req.rollNumber || '235'}_Health_Survey_Export_${new Date().toISOString().split('T')[0]}.csv`;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csvData);
        } catch (err) {
            console.error('CSV Export Error:', err);
            res.status(500).json({ error: 'Failed to generate CSV export: ' + err.message });
        }
    },

    exportPdf(req, res) {
        try {
            const filename = `Roll_${req.rollNumber || '235'}_Health_Survey_Report_${new Date().toISOString().split('T')[0]}.pdf`;

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            generatePdfStream(req.studentId, res);
        } catch (err) {
            console.error('PDF Export Error:', err);
            res.status(500).json({ error: 'Failed to generate PDF report: ' + err.message });
        }
    },

    exportData(req, res) {
        try {
            const exportData = getStudentExportData(req.studentId);
            if (!exportData) {
                return res.status(404).json({ error: 'No survey data found for student.' });
            }
            res.json(exportData);
        } catch (err) {
            console.error('Export Data Error:', err);
            res.status(500).json({ error: 'Failed to fetch export data: ' + err.message });
        }
    }
};

module.exports = SurveyController;
