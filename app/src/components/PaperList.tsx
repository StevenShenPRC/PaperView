import React from 'react';
import {
    Card, CardContent, Typography, CardActions, Button,
    Box, Chip, Link
} from '@mui/material';
import { Batch, Paper } from '../types';
import TranslateIcon from '@mui/icons-material/Translate';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import { Virtuoso } from 'react-virtuoso';

interface PaperListProps {
    papers: Paper[];
    onUpdateMetadata: (paper: Paper) => void;
    onTranslate: (paper: Paper) => void;
    batch: Batch | null;
}

const PaperList: React.FC<PaperListProps> = ({ papers, onUpdateMetadata, onTranslate, batch }) => {
    const { t } = useTranslation();

    return (
        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flexShrink: 0, mb: 2 }}>
                <Typography variant="h5" component="span" sx={{ fontWeight: 'bold' }}>
                    {batch ? batch.journalName : t('app.papers')}
                </Typography>
                {batch && (
                    <Typography
                        variant="body1"
                        component="span"
                        color="text.secondary"
                        sx={{ ml: 2, display: 'inline-block' }}
                    >
                        {`${batch.issueVolume} - ${batch.issueDate}`}
                    </Typography>
                )}
            </Box>

            <Virtuoso
                style={{ flex: 1 }}
                data={papers}
                itemContent={(_index: number, paper: Paper) => (
                    <Box sx={{ pb: 2 }}> {/* Add padding bottom to item container for spacing */}
                        <Card sx={{ mb: 0 }}> {/* Remove margin bottom from card as padding handles it */}
                            <CardContent>
                                <Typography variant="h6" color="primary" gutterBottom>
                                    {paper.title}
                                </Typography>
                                {paper.title_cn && (
                                    <Typography variant="subtitle1" color="textSecondary" gutterBottom>
                                        {paper.title_cn}
                                    </Typography>
                                )}

                                <Box sx={{ mb: 1 }}>
                                    <Chip label={paper.journalName} size="small" sx={{ mr: 1 }} />
                                    <Link href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener">
                                        {paper.doi}
                                    </Link>
                                </Box>

                                <Typography variant="body2" color="text.secondary" paragraph>
                                    {paper.abstract || t('app.no_abstract')}
                                </Typography>

                                {paper.abstract_cn && (
                                    <Box sx={{ bgcolor: 'action.selected', p: 1, borderRadius: 1, mt: 1 }}>
                                        <Typography variant="body2" color="text.primary">
                                            {paper.abstract_cn}
                                        </Typography>
                                    </Box>
                                )}
                            </CardContent>
                            <CardActions>
                                <Button
                                    startIcon={<TranslateIcon />}
                                    size="small"
                                    onClick={() => onTranslate(paper)}
                                >
                                    {t('app.translate')}
                                </Button>

                                <Button
                                    startIcon={<RefreshIcon />}
                                    size="small"
                                    onClick={() => onUpdateMetadata(paper)}
                                >
                                    {t('app.update_metadata')}
                                </Button>

                            </CardActions>
                        </Card>
                    </Box>
                )}
            />
        </Box>
    );
};

export default PaperList;
