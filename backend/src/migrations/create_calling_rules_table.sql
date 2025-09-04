-- Create calling_rules table
CREATE TABLE IF NOT EXISTS calling_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    dos BOOLEAN NOT NULL DEFAULT true,
    weight INTEGER NOT NULL CHECK (weight >= 0 AND weight <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_calling_rules_dos ON calling_rules(dos);
CREATE INDEX IF NOT EXISTS idx_calling_rules_weight ON calling_rules(weight);
CREATE INDEX IF NOT EXISTS idx_calling_rules_created_at ON calling_rules(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_calling_rules_updated_at 
    BEFORE UPDATE ON calling_rules 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data
INSERT INTO calling_rules (title, description, dos, weight) VALUES
('Greet customers warmly', 'Always start calls with a friendly greeting and introduce yourself', true, 90),
('Listen actively', 'Pay full attention to customer concerns and ask clarifying questions', true, 85),
('Use customer name', 'Address customers by their name throughout the conversation', true, 75),
('Provide clear solutions', 'Offer specific, actionable solutions to customer problems', true, 80),
('Follow up promptly', 'Return calls and emails within the promised timeframe', true, 70),
('Interrupt customers', 'Never interrupt customers while they are speaking', false, 95),
('Use inappropriate language', 'Avoid profanity, slang, or unprofessional language', false, 100),
('Make promises you cannot keep', 'Only commit to what you can actually deliver', false, 90),
('Transfer without explanation', 'Always explain why you are transferring a call', false, 85),
('End calls abruptly', 'Always thank customers and ask if there is anything else you can help with', false, 80)
ON CONFLICT DO NOTHING;
